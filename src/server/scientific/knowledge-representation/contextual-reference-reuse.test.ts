import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contextualNeedId } from "./contextual-authorization";
import type { BibliographicCandidate } from "./contextual-bibliographic-discovery";
import type { ContextualNeed } from "./contextual-need";
import {
  checksumContent,
  createExternalContextAcquisitionRegistry,
  type ExternalContextAcquisition,
} from "./external-context-acquisition";
import {
  createExternalContextReferenceRegistry,
  type ExternalContextReference,
} from "./external-context-reference";
import {
  CONTEXTUAL_REFERENCE_REUSE_EVALUATION_VERSION,
  evaluateContextualReferenceReuse,
  type ContextualReferenceReusePolicy,
  type EvaluateContextualReferenceReuseInput,
  type VerifiedSourceObservation,
} from "./contextual-reference-reuse";

const need: ContextualNeed = {
  version: "contextual-need.v1",
  articleId: "article:synthetic-a",
  subject: {
    kind: "endpoint_measure",
    endpointId: "endpoint:synthetic-a",
    name: "Synthetic endpoint",
    measure: "Synthetic scale",
  },
  supportingFactIds: ["fact:synthetic-a", "fact:synthetic-b"],
  evidenceAnchorIds: ["anchor:synthetic-article"],
  detectedGap: "endpoint_measure_definition_not_structured",
  contextualQuestion: "What does the synthetic scale measure?",
  editorialPurpose: "explain_endpoint_measure",
  method: { name: "central-endpoint-structural-gap", version: "1" },
  status: "candidate",
};

const reference: ExternalContextReference = {
  schemaVersion: "external-context-reference.v1",
  id: "reference:synthetic-doi",
  sourceClass: "bibliographic_record",
  provider: "synthetic-offline-fixture",
  canonicalIdentifier: { scheme: "doi", value: "10.0000/synthetic" },
  canonicalLocator: "https://example.invalid/10.0000/synthetic",
  title: "Synthetic reference for reuse evaluation",
  sourceVersion: "version-1",
};

const referenceRegistry = createExternalContextReferenceRegistry([reference]);
const acquisition: ExternalContextAcquisition = createExternalContextAcquisitionRegistry(
  referenceRegistry,
  [
    {
      id: "acquisition:synthetic-doi-v1",
      externalContextReferenceId: reference.id,
      retrievedAt: "2026-09-20T12:00:00Z",
      contentScope: "excerpt",
      accessAndLicensing: {
        accessStatus: "publicly_accessible",
        license: {
          status: "declared",
          identifier: "Synthetic fixture license",
          evidenceLocator: "https://example.invalid/licenses/synthetic",
        },
      },
      acquisitionMethod: { name: "manual_supplied_content", version: "1" },
      content: { mediaType: "text/plain", value: "Synthetic acquired evidence." },
      anchors: [
        {
          id: "acquisition-anchor:synthetic-doi-v1",
          locator: { kind: "unicode_code_point_range", start: 0, end: 9 },
        },
      ],
    },
  ],
).resolve("acquisition:synthetic-doi-v1");

function candidate(overrides: Partial<BibliographicCandidate> = {}): BibliographicCandidate {
  const needId = contextualNeedId(need);
  return {
    schemaVersion: "bibliographic-candidate.v1",
    canonicalIdentifier: { scheme: "doi", value: "10.0000/synthetic" },
    identifiers: { doi: "10.0000/synthetic", pmid: "100", pmcid: "PMC100" },
    title: "Synthetic bibliographic candidate",
    returnedBy: ["pubmed"],
    locators: ["https://example.invalid/records/synthetic"],
    publicationMetadata: {
      authors: [],
      journal: null,
      publisher: null,
      publishedAt: null,
      language: null,
      publicationTypes: [],
      volume: null,
      issue: null,
      pages: null,
    },
    discoveryProvenance: {
      requestId: "discovery:synthetic",
      contextualNeedId: needId,
      query: "synthetic query",
      sourceRecords: [],
      adapterReturns: [],
    },
    contextualNeed: need,
    ...overrides,
  };
}

const policy: ContextualReferenceReusePolicy = {
  schemaVersion: "contextual-reference-reuse-policy.v1",
  maximumAgeDays: 30,
  acceptedContentScopes: ["excerpt", "page_or_section", "full_text"],
  allowedAccessStatuses: ["publicly_accessible"],
  requireDeclaredLicense: true,
};

function observation(
  overrides: Partial<VerifiedSourceObservation> = {},
): VerifiedSourceObservation {
  return {
    schemaVersion: "verified-source-observation.v1",
    id: "observation:synthetic-current",
    referenceId: reference.id,
    acquisitionId: acquisition.id,
    observedAt: "2026-09-28T11:00:00Z",
    verifiedBy: { id: "reviewer:synthetic-human" },
    sourceState: "unchanged",
    sourceVersion: reference.sourceVersion ?? null,
    checksum: acquisition.checksum.value,
    anchorsIntegrity: "valid",
    ...overrides,
  };
}

function evaluate(overrides: Partial<EvaluateContextualReferenceReuseInput> = {}) {
  return evaluateContextualReferenceReuse({
    contextualNeed: need,
    reference,
    acquisition,
    bibliographicCandidate: candidate(),
    asOf: "2026-09-28T12:00:00Z",
    policy,
    verifiedObservations: [observation()],
    ...overrides,
  });
}

test("compatible artifacts are only candidates for human-reviewed reuse", () => {
  const result = evaluate();
  assert.equal(result.schemaVersion, CONTEXTUAL_REFERENCE_REUSE_EVALUATION_VERSION);
  assert.equal(result.state, "candidate_for_reuse_with_human_review");
  assert.equal(result.temporalPolicyCompliance, "compliant");
  assert.equal(result.externalSourceCurrency, "confirmed_current");
  assert.deepEqual(result.reasonCodes, ["TEMPORAL_POLICY_SATISFIED"]);
  assert.equal(result.createsEditorialAuthorization, false);
  for (const forbidden of [
    "ContextualClaimCandidate",
    "ContextualAuthorization",
    "ContextualScientificMaterial",
    "ScientificFact",
    "authorized",
    "approved",
  ])
    assert.equal(JSON.stringify(result).includes(forbidden), false);
});

test("missing acquisition and insufficient evidence stay explicitly uncertain", () => {
  const result = evaluate({ acquisition: undefined, verifiedObservations: [] });
  assert.equal(result.state, "update_or_reverification_required");
  assert.equal(result.temporalPolicyCompliance, "indeterminate");
  assert.equal(result.externalSourceCurrency, "unconfirmed");
  assert.deepEqual(result.reasonCodes, [
    "ACQUISITION_ABSENT",
    "EXTERNAL_CURRENCY_UNCONFIRMED",
    "TEMPORAL_STATUS_UNDETERMINED",
  ]);
});

test("exact identity is required and title similarity never establishes equivalence", () => {
  const divergentReference = {
    ...reference,
    canonicalIdentifier: { scheme: "doi", value: "10.0000/other" },
  };
  const result = evaluate({ reference: divergentReference });
  assert.equal(result.state, "reuse_blocked");
  assert.ok(result.reasonCodes.includes("BIBLIOGRAPHIC_IDENTITY_CONFLICT"));

  const titleOnly = evaluate({ bibliographicCandidate: undefined });
  assert.equal(titleOnly.state, "update_or_reverification_required");
  assert.ok(titleOnly.reasonCodes.includes("BIBLIOGRAPHIC_IDENTITY_UNCONFIRMED"));
});

test("conflicting DOI, PMID, and PMCID identities block reuse", () => {
  for (const scheme of ["doi", "pmid", "pmcid"] as const) {
    const values = { doi: "10.0000/synthetic", pmid: "100", pmcid: "PMC100" };
    const schemeReference = {
      ...reference,
      id: `reference:synthetic-${scheme}`,
      canonicalIdentifier: { scheme, value: values[scheme] },
    };
    const result = evaluate({
      reference: schemeReference,
      bibliographicCandidate: candidate({
        canonicalIdentifier: { scheme, value: `${values[scheme]}-conflict` },
        identifiers: { ...values, [scheme]: `${values[scheme]}-conflict` },
      }),
      acquisition: { ...acquisition, externalContextReferenceId: schemeReference.id },
      verifiedObservations: [],
    });
    assert.equal(result.state, "reuse_blocked", scheme);
    assert.ok(result.reasonCodes.includes("BIBLIOGRAPHIC_IDENTITY_CONFLICT"), scheme);
  }
});

test("source version divergence and explicit age policy require reverification", () => {
  const changedVersion = evaluate({
    verifiedObservations: [observation({ sourceVersion: "version-2" })],
  });
  assert.equal(changedVersion.state, "update_or_reverification_required");
  assert.ok(changedVersion.reasonCodes.includes("SOURCE_VERSION_CHANGED"));

  const outsideWindow = evaluate({
    asOf: "2026-10-21T12:00:00Z",
    verifiedObservations: [observation({ observedAt: "2026-10-21T11:00:00Z" })],
  });
  assert.equal(outsideWindow.temporalPolicyCompliance, "noncompliant");
  assert.ok(outsideWindow.reasonCodes.includes("ACQUISITION_OUTSIDE_TEMPORAL_POLICY"));

  const noMaximum = evaluate({
    asOf: "2036-09-28T12:00:00Z",
    policy: { ...policy, maximumAgeDays: null },
    verifiedObservations: [observation({ observedAt: "2036-09-28T11:00:00Z" })],
  });
  assert.equal(noMaximum.temporalPolicyCompliance, "compliant");
  assert.equal(noMaximum.state, "candidate_for_reuse_with_human_review");
});

test("known content changes, invalid checksum, and invalid anchors block reuse", () => {
  const changed = evaluate({
    verifiedObservations: [
      observation({
        sourceState: "changed",
        checksum: "f".repeat(64),
        anchorsIntegrity: "invalid",
      }),
    ],
  });
  assert.equal(changed.state, "reuse_blocked");
  assert.equal(changed.externalSourceCurrency, "known_changed");
  assert.ok(changed.reasonCodes.includes("SOURCE_CHANGED"));
  assert.ok(changed.reasonCodes.includes("CHECKSUM_CHANGED"));
  assert.ok(changed.reasonCodes.includes("ANCHORS_INVALID"));

  const malformed = evaluate({
    acquisition: {
      ...acquisition,
      checksum: { algorithm: "sha256", value: "0".repeat(64) },
    },
  });
  assert.equal(malformed.state, "reuse_blocked");
  assert.ok(malformed.reasonCodes.includes("ACQUISITION_ARTIFACT_INVALID"));
});

test("scope, access, and license requirements are policy-controlled", () => {
  const restrictedMetadata = {
    ...acquisition,
    contentScope: "metadata" as const,
    accessAndLicensing: {
      accessStatus: "restricted" as const,
      license: { status: "unknown" as const },
    },
  };
  const result = evaluate({ acquisition: restrictedMetadata, verifiedObservations: [] });
  assert.equal(result.state, "update_or_reverification_required");
  assert.ok(result.reasonCodes.includes("CONTENT_SCOPE_INSUFFICIENT"));
  assert.ok(result.reasonCodes.includes("ACCESS_INCOMPATIBLE_WITH_POLICY"));
  assert.ok(result.reasonCodes.includes("LICENSE_INCOMPATIBLE_WITH_POLICY"));
});

test("future dates fail closed and invalid dates are rejected by input contracts", () => {
  const future = evaluate({
    acquisition: { ...acquisition, retrievedAt: "2026-09-29T12:00:00Z" },
  });
  assert.equal(future.state, "update_or_reverification_required");
  assert.equal(future.temporalPolicyCompliance, "indeterminate");
  assert.ok(future.reasonCodes.includes("ACQUISITION_FUTURE_DATED"));
  assert.throws(() => evaluate({ asOf: "not-a-date" }), /datetime/);
  const invalidAcquisition = evaluate({
    acquisition: { ...acquisition, retrievedAt: "not-a-date" },
  });
  assert.ok(invalidAcquisition.reasonCodes.includes("ACQUISITION_ARTIFACT_INVALID"));
});

test("contextual need identity preserves article isolation", () => {
  const otherNeed = { ...need, articleId: "article:synthetic-b" };
  const result = evaluate({ contextualNeed: otherNeed });
  assert.equal(result.state, "reuse_blocked");
  assert.ok(result.reasonCodes.includes("ARTICLE_SCOPE_MISMATCH"));
  assert.equal(result.artifactIds.articleId, otherNeed.articleId);
});

test("observation ordering and evaluation results are deterministic without mutating inputs", () => {
  const observations = [observation({ id: "observation:z" }), observation({ id: "observation:a" })];
  const before = structuredClone(observations);
  const forward = evaluate({ verifiedObservations: observations });
  const reverse = evaluate({ verifiedObservations: [...observations].reverse() });
  assert.deepEqual(forward, reverse);
  assert.deepEqual(observations, before);
  assert.deepEqual(forward.artifactIds.observationIds, ["observation:a", "observation:z"]);
  assert.deepEqual(forward.reasonCodes, [...forward.reasonCodes].sort());
});

test("the boundary is server-only, offline, and does not bypass authorization", () => {
  assert.equal(checksumContent(acquisition.content.value), acquisition.checksum.value);
  const implementation = readFileSync(
    new URL("./contextual-reference-reuse.ts", import.meta.url),
    "utf8",
  );
  assert.match(implementation, /import "\.\.\/server-only"/);
  assert.doesNotMatch(implementation, /\bfetch\s*\(|OpenAI|Supabase|Vercel/);
  assert.doesNotMatch(implementation, /createContextualAuthorizationRegistry|projectAuthorized/);
});
