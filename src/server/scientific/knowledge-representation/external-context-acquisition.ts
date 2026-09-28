import { createHash } from "node:crypto";
import { z } from "zod";
import type { createExternalContextReferenceRegistry } from "./external-context-reference";

export const EXTERNAL_CONTEXT_ACQUISITION_VERSION = "external-context-acquisition.v1" as const;
export const EXTERNAL_CONTEXT_ACQUISITION_ANCHOR_VERSION =
  "external-context-acquisition-anchor.v1" as const;

const id = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .regex(/^[a-z0-9][a-z0-9._-]*(?::[a-z0-9][a-z0-9._-]*)+$/);
const locator = z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
  message: "Evidence locator must use HTTP or HTTPS",
});
const sha256 = z
  .object({ algorithm: z.literal("sha256"), value: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();

export const externalContextAcquisitionAnchorSchema = z
  .object({
    schemaVersion: z.literal(EXTERNAL_CONTEXT_ACQUISITION_ANCHOR_VERSION),
    id,
    acquisitionId: id,
    locator: z
      .object({
        kind: z.literal("unicode_code_point_range"),
        start: z.number().int().nonnegative(),
        end: z.number().int().positive(),
      })
      .strict(),
    excerpt: z.string().min(1),
  })
  .strict()
  .superRefine((anchor, context) => {
    if (anchor.locator.end <= anchor.locator.start)
      context.addIssue({ code: "custom", path: ["locator"], message: "end must be after start" });
  });

const accessAndLicensingSchema = z
  .object({
    accessStatus: z.enum(["publicly_accessible", "restricted", "unknown"]),
    license: z.discriminatedUnion("status", [
      z.object({ status: z.literal("unknown") }).strict(),
      z
        .object({
          status: z.literal("declared"),
          identifier: z.string().trim().min(1).max(500),
          evidenceLocator: locator,
        })
        .strict(),
    ]),
    fullTextAcquisitionBasis: z
      .object({
        status: z.literal("explicitly_declared"),
        statement: z.string().trim().min(1).max(1_000),
        evidenceLocator: locator,
      })
      .strict()
      .optional(),
  })
  .strict();

export const externalContextAcquisitionSchema = z
  .object({
    schemaVersion: z.literal(EXTERNAL_CONTEXT_ACQUISITION_VERSION),
    id,
    externalContextReferenceId: id,
    retrievedAt: z.iso.datetime({ offset: true }),
    contentScope: z.enum(["metadata", "abstract", "excerpt", "page_or_section", "full_text"]),
    accessAndLicensing: accessAndLicensingSchema,
    acquisitionMethod: z
      .object({
        name: z.literal("manual_supplied_content"),
        version: z.string().trim().min(1).max(100),
      })
      .strict(),
    content: z
      .object({
        mediaType: z.enum(["text/plain", "application/json"]),
        value: z.string().min(1),
      })
      .strict(),
    checksum: sha256,
    anchors: z.array(externalContextAcquisitionAnchorSchema),
  })
  .strict()
  .superRefine((acquisition, context) => {
    if (
      acquisition.contentScope === "full_text" &&
      (acquisition.accessAndLicensing.license.status !== "declared" ||
        acquisition.accessAndLicensing.fullTextAcquisitionBasis?.status !== "explicitly_declared")
    )
      context.addIssue({
        code: "custom",
        path: ["accessAndLicensing"],
        message: "full text requires a declared license and explicit acquisition basis",
      });

    const expectedChecksum = checksumContent(acquisition.content.value);
    if (acquisition.checksum.value !== expectedChecksum)
      context.addIssue({
        code: "custom",
        path: ["checksum"],
        message: "checksum does not match normalized acquired content",
      });

    const codePoints = Array.from(acquisition.content.value);
    const anchorIds = new Set<string>();
    for (const [index, anchor] of acquisition.anchors.entries()) {
      if (anchorIds.has(anchor.id))
        context.addIssue({
          code: "custom",
          path: ["anchors", index, "id"],
          message: `Duplicate acquisition anchor ID: ${anchor.id}`,
        });
      anchorIds.add(anchor.id);
      if (anchor.acquisitionId !== acquisition.id)
        context.addIssue({
          code: "custom",
          path: ["anchors", index, "acquisitionId"],
          message: "anchor must reference its containing acquisition",
        });
      const excerpt = codePoints.slice(anchor.locator.start, anchor.locator.end).join("");
      if (!excerpt || excerpt !== anchor.excerpt)
        context.addIssue({
          code: "custom",
          path: ["anchors", index, "locator"],
          message: "anchor locator must reproduce its excerpt from acquired content",
        });
    }
  });

export type ExternalContextAcquisition = z.infer<typeof externalContextAcquisitionSchema>;
export type ExternalContextAcquisitionAnchor = z.infer<
  typeof externalContextAcquisitionAnchorSchema
>;
type ReferenceRegistry = ReturnType<typeof createExternalContextReferenceRegistry>;

export interface ExternalContextAcquisitionInput {
  id: string;
  externalContextReferenceId: string;
  retrievedAt: string;
  contentScope: ExternalContextAcquisition["contentScope"];
  accessAndLicensing: ExternalContextAcquisition["accessAndLicensing"];
  acquisitionMethod: ExternalContextAcquisition["acquisitionMethod"];
  content: ExternalContextAcquisition["content"];
  anchors: ReadonlyArray<{
    id: string;
    locator: ExternalContextAcquisitionAnchor["locator"];
  }>;
}

export class DuplicateExternalContextAcquisitionError extends Error {
  constructor(id: string) {
    super(`Duplicate external context acquisition ID: ${id}`);
    this.name = "DuplicateExternalContextAcquisitionError";
  }
}

export class DuplicateExternalContextAcquisitionAnchorError extends Error {
  constructor(id: string) {
    super(`Duplicate external context acquisition anchor ID: ${id}`);
    this.name = "DuplicateExternalContextAcquisitionAnchorError";
  }
}

/** Normalization is Unicode NFC plus CRLF/CR to LF; no whitespace is trimmed or collapsed. */
export function normalizeAcquiredContent(value: string) {
  return value.normalize("NFC").replace(/\r\n?/g, "\n");
}

/** SHA-256 is computed over the UTF-8 bytes of normalized acquired content.value only. */
export function checksumContent(value: string) {
  return createHash("sha256").update(normalizeAcquiredContent(value), "utf8").digest("hex");
}

export function createExternalContextAcquisitionRegistry(
  referenceRegistry: ReferenceRegistry,
  inputs: readonly ExternalContextAcquisitionInput[],
) {
  const acquisitions = new Map<string, ExternalContextAcquisition>();
  const anchors = new Map<string, ExternalContextAcquisitionAnchor>();

  for (const input of inputs) {
    referenceRegistry.resolve(input.externalContextReferenceId);
    if (acquisitions.has(input.id)) throw new DuplicateExternalContextAcquisitionError(input.id);

    const normalizedContent = normalizeAcquiredContent(input.content.value);
    const codePoints = Array.from(normalizedContent);
    const acquisition = externalContextAcquisitionSchema.parse({
      schemaVersion: EXTERNAL_CONTEXT_ACQUISITION_VERSION,
      ...input,
      content: { ...input.content, value: normalizedContent },
      checksum: { algorithm: "sha256", value: checksumContent(normalizedContent) },
      anchors: input.anchors.map((anchor) => ({
        schemaVersion: EXTERNAL_CONTEXT_ACQUISITION_ANCHOR_VERSION,
        ...anchor,
        acquisitionId: input.id,
        excerpt: codePoints.slice(anchor.locator.start, anchor.locator.end).join(""),
      })),
    });

    for (const anchor of acquisition.anchors) {
      if (anchors.has(anchor.id))
        throw new DuplicateExternalContextAcquisitionAnchorError(anchor.id);
      anchors.set(anchor.id, anchor);
    }
    acquisitions.set(acquisition.id, acquisition);
  }

  return Object.freeze({
    resolve(id: string) {
      const acquisition = acquisitions.get(id);
      if (!acquisition) throw new Error(`Unknown external context acquisition ID: ${id}`);
      return externalContextAcquisitionSchema.parse(acquisition);
    },
    resolveAnchor(id: string) {
      const anchor = anchors.get(id);
      if (!anchor) throw new Error(`Unknown external context acquisition anchor ID: ${id}`);
      return externalContextAcquisitionAnchorSchema.parse(anchor);
    },
  });
}
