import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  checksumContent,
  createExternalContextAcquisitionRegistry,
  DuplicateExternalContextAcquisitionAnchorError,
  DuplicateExternalContextAcquisitionError,
  EXTERNAL_CONTEXT_ACQUISITION_ANCHOR_VERSION,
  EXTERNAL_CONTEXT_ACQUISITION_VERSION,
  externalContextAcquisitionSchema,
  normalizeAcquiredContent,
  type ExternalContextAcquisitionInput,
} from "./external-context-acquisition";
import {
  createExternalContextReferenceRegistry,
  externalContextReferenceSchema,
  UnknownExternalContextReferenceError,
} from "./external-context-reference";

const bibliographicReference = externalContextReferenceSchema.parse({
  schemaVersion: "external-context-reference.v1",
  id: "offline-bibliography:synthetic-001",
  sourceClass: "bibliographic_record",
  provider: "offline-fixture",
  canonicalIdentifier: { scheme: "synthetic-record", value: "001" },
  canonicalLocator: "https://example.invalid/bibliography/synthetic-001",
  title: "Synthetic bibliographic acquisition fixture",
});

const institutionalReference = externalContextReferenceSchema.parse({
  schemaVersion: "external-context-reference.v1",
  id: "offline-institution:synthetic-002:v1",
  sourceClass: "regulatory_or_institutional_document",
  provider: "offline-fixture",
  canonicalIdentifier: { scheme: "synthetic-document", value: "002" },
  canonicalLocator: "https://example.invalid/institution/synthetic-002",
  title: "Synthetic institutional acquisition fixture",
});

const references = createExternalContextReferenceRegistry([
  bibliographicReference,
  institutionalReference,
]);

function acquisition(
  overrides: Partial<ExternalContextAcquisitionInput> = {},
): ExternalContextAcquisitionInput {
  return {
    id: "offline-acquisition:abstract-001",
    externalContextReferenceId: bibliographicReference.id,
    retrievedAt: "2026-09-28T12:00:00Z",
    contentScope: "abstract",
    accessAndLicensing: {
      accessStatus: "publicly_accessible",
      license: { status: "unknown" },
    },
    acquisitionMethod: { name: "manual_supplied_content", version: "fixture-v1" },
    content: { mediaType: "text/plain", value: "Background. Synthetic abstract content." },
    anchors: [
      {
        id: "offline-anchor:abstract-background-001",
        locator: { kind: "unicode_code_point_range", start: 0, end: 11 },
      },
    ],
    ...overrides,
  };
}

test("external-context-acquisition.v1 creates offline acquisitions and reproducible anchors", () => {
  const registry = createExternalContextAcquisitionRegistry(references, [acquisition()]);
  const result = registry.resolve("offline-acquisition:abstract-001");
  const anchor = registry.resolveAnchor("offline-anchor:abstract-background-001");

  assert.equal(EXTERNAL_CONTEXT_ACQUISITION_VERSION, "external-context-acquisition.v1");
  assert.equal(
    EXTERNAL_CONTEXT_ACQUISITION_ANCHOR_VERSION,
    "external-context-acquisition-anchor.v1",
  );
  assert.equal(result.schemaVersion, EXTERNAL_CONTEXT_ACQUISITION_VERSION);
  assert.equal(result.externalContextReferenceId, bibliographicReference.id);
  assert.equal(result.contentScope, "abstract");
  assert.equal(result.retrievedAt, "2026-09-28T12:00:00Z");
  assert.equal(anchor.acquisitionId, result.id);
  assert.deepEqual(anchor.locator, {
    kind: "unicode_code_point_range",
    start: 0,
    end: 11,
  });
  assert.equal(anchor.excerpt, "Background.");
});

test("institutional page/section content remains its explicitly supplied scope", () => {
  const result = createExternalContextAcquisitionRegistry(references, [
    acquisition({
      id: "offline-acquisition:institutional-section-002",
      externalContextReferenceId: institutionalReference.id,
      contentScope: "page_or_section",
      content: { mediaType: "text/plain", value: "Section 2. Synthetic institutional text." },
      anchors: [
        {
          id: "offline-anchor:institutional-section-002",
          locator: { kind: "unicode_code_point_range", start: 0, end: 10 },
        },
      ],
    }),
  ]).resolve("offline-acquisition:institutional-section-002");

  assert.equal(result.contentScope, "page_or_section");
  assert.notEqual(result.contentScope, "full_text");
});

test("scope is explicit and never inferred or promoted from supplied content", () => {
  for (const [index, contentScope] of (["metadata", "abstract", "excerpt"] as const).entries()) {
    const id = `offline-acquisition:scope-${index}`;
    const result = createExternalContextAcquisitionRegistry(references, [
      acquisition({
        id,
        contentScope,
        content:
          contentScope === "metadata"
            ? { mediaType: "application/json", value: '{"syntheticField":"synthetic value"}' }
            : { mediaType: "text/plain", value: "The same synthetic supplied content." },
        anchors: [],
      }),
    ]).resolve(id);
    assert.equal(result.contentScope, contentScope);
    if (contentScope !== "abstract") assert.notEqual(result.contentScope, "abstract");
    assert.notEqual(result.contentScope, "full_text");
  }
});

test("unknown references and invalid retrieval timestamps fail explicitly", () => {
  assert.throws(
    () =>
      createExternalContextAcquisitionRegistry(references, [
        acquisition({ externalContextReferenceId: "offline-bibliography:missing" }),
      ]),
    UnknownExternalContextReferenceError,
  );
  assert.throws(
    () =>
      createExternalContextAcquisitionRegistry(references, [acquisition({ retrievedAt: "today" })]),
    /retrievedAt/,
  );
});

test("access and licensing observations remain unknown rather than being invented", () => {
  const result = createExternalContextAcquisitionRegistry(references, [
    acquisition({
      accessAndLicensing: { accessStatus: "unknown", license: { status: "unknown" } },
    }),
  ]).resolve("offline-acquisition:abstract-001");

  assert.deepEqual(result.accessAndLicensing, {
    accessStatus: "unknown",
    license: { status: "unknown" },
  });
  assert.equal("fullTextAcquisitionBasis" in result.accessAndLicensing, false);
});

test("checksum uses only deterministic normalized acquired content", () => {
  const decomposed = "Cafe\u0301\r\nSynthetic content";
  const normalized = "Café\nSynthetic content";
  assert.equal(normalizeAcquiredContent(decomposed), normalized);
  assert.equal(checksumContent(decomposed), checksumContent(normalized));
  assert.notEqual(checksumContent(normalized), checksumContent(`${normalized}.`));

  const first = createExternalContextAcquisitionRegistry(references, [
    acquisition({ content: { mediaType: "text/plain", value: decomposed }, anchors: [] }),
  ]).resolve("offline-acquisition:abstract-001");
  const second = createExternalContextAcquisitionRegistry(references, [
    acquisition({ content: { mediaType: "text/plain", value: normalized }, anchors: [] }),
  ]).resolve("offline-acquisition:abstract-001");
  assert.equal(first.checksum.value, second.checksum.value);
  assert.equal(first.checksum.value, checksumContent(first.content.value));
});

test("snapshot validation fails closed for broken checksum and anchor provenance", () => {
  const valid = createExternalContextAcquisitionRegistry(references, [acquisition()]).resolve(
    "offline-acquisition:abstract-001",
  );
  assert.equal(
    externalContextAcquisitionSchema.safeParse({
      ...valid,
      checksum: { ...valid.checksum, value: "0".repeat(64) },
    }).success,
    false,
  );
  assert.equal(
    externalContextAcquisitionSchema.safeParse({
      ...valid,
      anchors: [{ ...valid.anchors[0], acquisitionId: "offline-acquisition:missing" }],
    }).success,
    false,
  );
  assert.throws(
    () =>
      createExternalContextAcquisitionRegistry(references, [
        acquisition({
          anchors: [
            {
              id: "offline-anchor:invalid-range",
              locator: { kind: "unicode_code_point_range", start: 500, end: 510 },
            },
          ],
        }),
      ]),
    /anchors|excerpt|locator/,
  );
});

test("duplicate acquisition and anchor IDs fail explicitly", () => {
  assert.throws(
    () => createExternalContextAcquisitionRegistry(references, [acquisition(), acquisition()]),
    DuplicateExternalContextAcquisitionError,
  );
  assert.throws(
    () =>
      createExternalContextAcquisitionRegistry(references, [
        acquisition(),
        acquisition({
          id: "offline-acquisition:second",
          anchors: [
            {
              id: "offline-anchor:abstract-background-001",
              locator: { kind: "unicode_code_point_range", start: 0, end: 11 },
            },
          ],
        }),
      ]),
    DuplicateExternalContextAcquisitionAnchorError,
  );
});

test("registry results are isolated from caller mutation", () => {
  const registry = createExternalContextAcquisitionRegistry(references, [acquisition()]);
  const result = registry.resolve("offline-acquisition:abstract-001");
  result.content.value = "Caller mutation";
  result.anchors[0].excerpt = "Caller mutation";
  assert.equal(
    registry.resolve("offline-acquisition:abstract-001").content.value,
    "Background. Synthetic abstract content.",
  );
  assert.equal(
    registry.resolveAnchor("offline-anchor:abstract-background-001").excerpt,
    "Background.",
  );
});

test("full text fails closed without declared license and explicit acquisition basis", () => {
  assert.throws(
    () =>
      createExternalContextAcquisitionRegistry(references, [
        acquisition({ contentScope: "full_text", anchors: [] }),
      ]),
    /full text requires/,
  );

  const result = createExternalContextAcquisitionRegistry(references, [
    acquisition({
      contentScope: "full_text",
      anchors: [],
      accessAndLicensing: {
        accessStatus: "restricted",
        license: {
          status: "declared",
          identifier: "Synthetic fixture license",
          evidenceLocator: "https://example.invalid/licenses/synthetic",
        },
        fullTextAcquisitionBasis: {
          status: "explicitly_declared",
          statement: "Synthetic fixture explicitly permits this controlled acquisition.",
          evidenceLocator: "https://example.invalid/licenses/synthetic#full-text",
        },
      },
    }),
  ]).resolve("offline-acquisition:abstract-001");
  assert.equal(result.contentScope, "full_text");
});

test("ACQUISITION DOES NOT EQUAL AUTHORIZATION or scientific material", () => {
  const result = createExternalContextAcquisitionRegistry(references, [acquisition()]).resolve(
    "offline-acquisition:abstract-001",
  );
  for (const field of [
    "authorized",
    "approved",
    "reviewed",
    "contextualClaim",
    "editorialPermission",
    "contextualScientificMaterial",
    "inferenceBoundary",
    "quantitativeAuthority",
    "contextualNeed",
  ])
    assert.equal(field in result, false, field);

  const implementation = readFileSync(
    new URL("./external-context-acquisition.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(implementation, /\bfetch\s*\(/);
  assert.doesNotMatch(implementation, /OpenAI|ContextualScientificMaterial|contextual-need/);
});
