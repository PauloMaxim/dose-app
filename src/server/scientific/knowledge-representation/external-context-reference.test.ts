import assert from "node:assert/strict";
import test from "node:test";
import {
  createExternalContextReferenceRegistry,
  DuplicateExternalContextReferenceError,
  EXTERNAL_CONTEXT_REFERENCE_VERSION,
  externalContextReferenceSchema,
  UnknownExternalContextReferenceError,
  type ExternalContextReference,
} from "./external-context-reference";

const bibliographicReference = externalContextReferenceSchema.parse({
  schemaVersion: "external-context-reference.v1",
  id: "offline-bibliography:record-001",
  sourceClass: "bibliographic_record",
  provider: "offline-bibliography",
  canonicalIdentifier: { scheme: "offline-record", value: "record-001" },
  canonicalLocator: "https://example.invalid/bibliography/record-001",
  title: "Offline bibliographic contract fixture",
});

const institutionalReference = externalContextReferenceSchema.parse({
  schemaVersion: "external-context-reference.v1",
  id: "offline-institution:document-002:v1",
  sourceClass: "regulatory_or_institutional_document",
  provider: "offline-institution",
  canonicalIdentifier: { scheme: "document", value: "document-002" },
  canonicalLocator: "https://example.invalid/institution/documents/document-002",
  title: "Offline institutional contract fixture",
  publisherOrAuthority: "Offline fixture authority",
  effectiveDate: "2026-09-28",
  sourceVersion: "v1",
});

test("external-context-reference.v1 validates identity metadata and stable IDs", () => {
  assert.equal(EXTERNAL_CONTEXT_REFERENCE_VERSION, "external-context-reference.v1");
  assert.deepEqual(bibliographicReference, {
    schemaVersion: EXTERNAL_CONTEXT_REFERENCE_VERSION,
    id: "offline-bibliography:record-001",
    sourceClass: "bibliographic_record",
    provider: "offline-bibliography",
    canonicalIdentifier: { scheme: "offline-record", value: "record-001" },
    canonicalLocator: "https://example.invalid/bibliography/record-001",
    title: "Offline bibliographic contract fixture",
  });
  assert.equal(institutionalReference.sourceClass, "regulatory_or_institutional_document");
});

test("invalid or acquisition-shaped metadata is rejected", () => {
  for (const candidate of [
    { ...bibliographicReference, schemaVersion: "external-context-reference.v2" },
    { ...bibliographicReference, id: "unscoped-id" },
    { ...bibliographicReference, canonicalIdentifier: { scheme: "pmid", value: "" } },
    { ...bibliographicReference, canonicalLocator: "file:///tmp/record" },
    { ...bibliographicReference, sourceClass: "medical_ontology_term" },
    { ...bibliographicReference, retrievedAt: "2026-09-28T00:00:00Z" },
    { ...bibliographicReference, acquiredContentScope: "full_text" },
    { ...bibliographicReference, authorized: true },
  ])
    assert.equal(externalContextReferenceSchema.safeParse(candidate).success, false);
});

test("partial dates remain valid while complete dates must exist in the calendar", () => {
  for (const publicationDate of ["2026", "2026-02", "2024-02-29"])
    assert.equal(
      externalContextReferenceSchema.safeParse({ ...bibliographicReference, publicationDate })
        .success,
      true,
      publicationDate,
    );

  for (const publicationDate of ["2026-02-29", "2026-02-31", "2026-04-31"])
    assert.equal(
      externalContextReferenceSchema.safeParse({ ...bibliographicReference, publicationDate })
        .success,
      false,
      publicationDate,
    );
});

test("acquisition-dependent fields may remain absent without synthetic values", () => {
  const parsed = externalContextReferenceSchema.parse(bibliographicReference);
  for (const field of [
    "retrievedAt",
    "acquiredContentScope",
    "accessStatus",
    "licensingStatus",
    "contentLocator",
    "excerptLocator",
    "checksum",
    "acquisitionMethod",
    "acquisitionVersion",
  ])
    assert.equal(field in parsed, false, field);
});

test("registry resolves validated references deterministically without order dependence", () => {
  const forward = createExternalContextReferenceRegistry([
    bibliographicReference,
    institutionalReference,
  ]);
  const reverse = createExternalContextReferenceRegistry([
    institutionalReference,
    bibliographicReference,
  ]);

  const first = forward.resolve(bibliographicReference.id);
  const second = forward.resolve(bibliographicReference.id);
  assert.deepEqual(first, bibliographicReference);
  assert.deepEqual(second, first);
  assert.deepEqual(reverse.resolve(bibliographicReference.id), first);

  first.title = "Caller mutation";
  assert.deepEqual(forward.resolve(bibliographicReference.id), bibliographicReference);
});

test("duplicate and unknown IDs fail explicitly", () => {
  assert.throws(
    () => createExternalContextReferenceRegistry([bibliographicReference, bibliographicReference]),
    DuplicateExternalContextReferenceError,
  );
  const registry = createExternalContextReferenceRegistry([bibliographicReference]);
  assert.throws(
    () => registry.resolve("offline-bibliography:unknown"),
    UnknownExternalContextReferenceError,
  );
});

test("RESOLUTION DOES NOT EQUAL AUTHORIZATION", () => {
  const before = structuredClone(bibliographicReference);
  const resolved = createExternalContextReferenceRegistry([bibliographicReference]).resolve(
    bibliographicReference.id,
  );
  assert.deepEqual(bibliographicReference, before);

  const forbiddenBoundaryFields = [
    "authorized",
    "approved",
    "reviewed",
    "contextualClaim",
    "editorialPermission",
    "quantitativeClaims",
    "inferenceBoundaries",
    "contextualScientificMaterial",
    "contextualNeed",
  ] satisfies Array<keyof ExternalContextReference | string>;
  for (const field of forbiddenBoundaryFields) assert.equal(field in resolved, false, field);
});
