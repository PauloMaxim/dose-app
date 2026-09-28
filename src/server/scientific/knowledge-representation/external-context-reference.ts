import { z } from "zod";

export const EXTERNAL_CONTEXT_REFERENCE_VERSION = "external-context-reference.v1" as const;

const identifierPart = z.string().trim().min(1).max(200);
const referenceId = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .regex(/^[a-z0-9][a-z0-9._-]*(?::[a-z0-9][a-z0-9._-]*)+$/);
const date = z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/);
const canonicalLocator = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Canonical locator must use HTTP or HTTPS");

/**
 * Identity metadata for an external context source. Acquisition-specific provenance (retrieval,
 * content scope, access/license status, content locator, checksum, and acquisition method) is
 * deliberately absent: it belongs to the later acquisition contract and must not be fabricated.
 */
export const externalContextReferenceSchema = z
  .object({
    schemaVersion: z.literal(EXTERNAL_CONTEXT_REFERENCE_VERSION),
    id: referenceId,
    sourceClass: z.enum(["bibliographic_record", "regulatory_or_institutional_document"]),
    provider: identifierPart,
    canonicalIdentifier: z.object({ scheme: identifierPart, value: identifierPart }).strict(),
    canonicalLocator,
    title: z.string().trim().min(1).max(2_000),
    publisherOrAuthority: z.string().trim().min(1).max(500).optional(),
    publicationDate: date.optional(),
    effectiveDate: date.optional(),
    sourceVersion: identifierPart.optional(),
  })
  .strict();

export type ExternalContextReference = z.infer<typeof externalContextReferenceSchema>;

export class DuplicateExternalContextReferenceError extends Error {
  constructor(id: string) {
    super(`Duplicate external context reference ID: ${id}`);
    this.name = "DuplicateExternalContextReferenceError";
  }
}

export class UnknownExternalContextReferenceError extends Error {
  constructor(id: string) {
    super(`Unknown external context reference ID: ${id}`);
    this.name = "UnknownExternalContextReferenceError";
  }
}

export function createExternalContextReferenceRegistry(
  references: readonly ExternalContextReference[],
) {
  const byId = new Map<string, ExternalContextReference>();
  for (const candidate of references) {
    const reference = externalContextReferenceSchema.parse(candidate);
    if (byId.has(reference.id)) throw new DuplicateExternalContextReferenceError(reference.id);
    byId.set(reference.id, reference);
  }

  return Object.freeze({
    resolve(id: string): ExternalContextReference {
      const reference = byId.get(id);
      if (!reference) throw new UnknownExternalContextReferenceError(id);
      return externalContextReferenceSchema.parse(reference);
    },
  });
}
