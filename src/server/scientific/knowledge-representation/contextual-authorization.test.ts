import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contextualNeedSchema, type ContextualNeed } from "./contextual-need";
import {
  checksumContent,
  createExternalContextAcquisitionRegistry,
  type ExternalContextAcquisitionInput,
} from "./external-context-acquisition";
import {
  createExternalContextReferenceRegistry,
  externalContextReferenceSchema,
} from "./external-context-reference";
import {
  CONTEXTUAL_AUTHORIZATION_VERSION,
  CONTEXTUAL_CLAIM_CANDIDATE_VERSION,
  contextualAuthorizationSchema,
  contextualClaimCandidateSchema,
  contextualNeedId,
  createContextualAuthorizationRegistry,
  createContextualClaimCandidateRegistry,
} from "./contextual-authorization";

const need: ContextualNeed = {
  version: "contextual-need.v1",
  articleId: "article:synthetic-001",
  subject: {
    kind: "endpoint_measure",
    endpointId: "endpoint-1",
    name: "Endpoint",
    measure: "Measure",
  },
  supportingFactIds: ["fact:1", "fact:2"],
  evidenceAnchorIds: ["evidence:1"],
  detectedGap: "endpoint_measure_definition_not_structured",
  contextualQuestion: "What does Measure measure?",
  editorialPurpose: "explain_endpoint_measure",
  method: { name: "central-endpoint-structural-gap", version: "1" },
  status: "candidate",
};

const reference = externalContextReferenceSchema.parse({
  schemaVersion: "external-context-reference.v1",
  id: "fixture-source:document-1",
  sourceClass: "regulatory_or_institutional_document",
  provider: "offline-fixture",
  canonicalIdentifier: { scheme: "fixture", value: "document-1" },
  canonicalLocator: "https://example.invalid/document-1",
  title: "Synthetic offline source",
});
const otherReference = externalContextReferenceSchema.parse({
  ...reference,
  id: "fixture-source:document-2",
  canonicalIdentifier: { scheme: "fixture", value: "document-2" },
  canonicalLocator: "https://example.invalid/document-2",
});
const content = "A synthetic endpoint statement. A second acquired statement.";
const acquisitionInput: ExternalContextAcquisitionInput = {
  id: "fixture-acquisition:document-1:v1",
  externalContextReferenceId: reference.id,
  retrievedAt: "2026-09-28T12:00:00Z",
  contentScope: "excerpt",
  accessAndLicensing: { accessStatus: "publicly_accessible", license: { status: "unknown" } },
  acquisitionMethod: { name: "manual_supplied_content", version: "1" },
  content: { mediaType: "text/plain", value: content },
  anchors: [
    {
      id: "fixture-anchor:document-1:a",
      locator: { kind: "unicode_code_point_range", start: 0, end: 31 },
    },
  ],
};
const otherAcquisitionInput: ExternalContextAcquisitionInput = {
  ...acquisitionInput,
  id: "fixture-acquisition:document-2:v1",
  externalContextReferenceId: otherReference.id,
  anchors: [
    {
      id: "fixture-anchor:document-2:a",
      locator: { kind: "unicode_code_point_range", start: 32, end: content.length },
    },
  ],
};

function boundaries(
  acquisitionInputs: readonly ExternalContextAcquisitionInput[] = [
    acquisitionInput,
    otherAcquisitionInput,
  ],
) {
  const references = createExternalContextReferenceRegistry([reference, otherReference]);
  const acquisitions = createExternalContextAcquisitionRegistry(references, acquisitionInputs);
  return { references, acquisitions };
}

function candidateInput(overrides: Record<string, unknown> = {}) {
  return {
    id: "contextual-claim:synthetic-001:v1",
    articleId: need.articleId,
    contextualNeedId: contextualNeedId(need),
    externalContextReferenceId: reference.id,
    externalContextAcquisitionId: acquisitionInput.id,
    externalContextAcquisitionAnchorIds: [acquisitionInput.anchors[0].id],
    statement: "The synthetic endpoint statement describes the fixture measure.",
    ...overrides,
  };
}

function candidateRegistry(
  inputs = [candidateInput()],
  contextualNeeds: readonly ContextualNeed[] = [need],
  acquisitionInputs?: readonly ExternalContextAcquisitionInput[],
) {
  const { references, acquisitions } = boundaries(acquisitionInputs);
  return createContextualClaimCandidateRegistry(
    contextualNeeds,
    references,
    acquisitions,
    inputs as never,
  );
}

test("contextual need identity is stable and covers its complete semantic content", () => {
  const identical = structuredClone(need);
  const differentQuestion = {
    ...structuredClone(need),
    contextualQuestion: "Which domain does Measure assess?",
  };
  const differentName = {
    ...structuredClone(need),
    subject: { ...need.subject, name: "Different endpoint name" },
  };
  const differentEvidence = {
    ...structuredClone(need),
    evidenceAnchorIds: ["evidence:2"],
  };
  const differentFacts = {
    ...structuredClone(need),
    supportingFactIds: ["fact:1", "fact:3"],
  };

  assert.equal(contextualNeedId(need), contextualNeedId(identical));
  assert.match(
    contextualNeedId(need),
    /^contextual-need:article:synthetic-001:endpoint-1:[a-f0-9]{64}$/,
  );
  for (const changed of [differentQuestion, differentName, differentEvidence, differentFacts])
    assert.notEqual(contextualNeedId(need), contextualNeedId(changed));
});

test("the registry validates and canonicalizes contextual needs before deriving identity", () => {
  const paddedNeed = {
    ...structuredClone(need),
    contextualQuestion: `  ${need.contextualQuestion}  `,
  } as ContextualNeed;
  const canonicalNeed = contextualNeedSchema.parse(paddedNeed);
  assert.equal(contextualNeedId(canonicalNeed), contextualNeedId(need));
  assert.doesNotThrow(() =>
    candidateRegistry(
      [candidateInput({ contextualNeedId: contextualNeedId(canonicalNeed) })],
      [paddedNeed],
    ),
  );

  const invalidNeed = {
    ...structuredClone(need),
    status: "authorized",
  } as unknown as ContextualNeed;
  assert.throws(() => candidateRegistry([], [invalidNeed]));
});

test("the registry rejects only truly identical contextual needs as duplicates", () => {
  assert.throws(
    () => candidateRegistry([], [need, structuredClone(need)]),
    /Duplicate contextual need ID/,
  );

  const semanticallyDifferent = {
    ...structuredClone(need),
    contextualQuestion: "Which domain does Measure assess?",
  };
  assert.doesNotThrow(() => candidateRegistry([], [need, semanticallyDifferent]));
});

test("a candidate cannot resolve through a semantically different need for the same endpoint", () => {
  const semanticallyDifferent = {
    ...structuredClone(need),
    contextualQuestion: "Which domain does Measure assess?",
  };
  assert.throws(
    () => candidateRegistry([candidateInput()], [semanticallyDifferent]),
    /Unknown contextual need ID/,
  );
});

test("authorization for the original need does not authorize the same claim under an altered need", () => {
  const originalCandidates = candidateRegistry();
  const originalCandidate = originalCandidates.resolve(candidateInput().id);
  const authorization = createContextualAuthorizationRegistry(originalCandidates, [
    {
      id: "contextual-authorization:need-scope:v1",
      claimCandidateId: originalCandidate.id,
      decision: "authorized",
      reviewer: { id: "reviewer:human-1" },
      reviewedAt: "2026-09-28T13:00:00Z",
    },
  ]);
  const alteredNeed = {
    ...structuredClone(need),
    contextualQuestion: "Which domain does Measure assess?",
  };
  const alteredCandidate = candidateRegistry(
    [candidateInput({ contextualNeedId: contextualNeedId(alteredNeed) })],
    [alteredNeed],
  ).resolve(originalCandidate.id);

  assert.deepEqual(authorization.authorizedClaims([alteredCandidate]), []);
});

test("a candidate has complete, anchored lineage and a deterministic exact-claim revision", () => {
  const first = candidateRegistry().resolve(candidateInput().id);
  const second = candidateRegistry().resolve(candidateInput().id);
  assert.equal(first.schemaVersion, CONTEXTUAL_CLAIM_CANDIDATE_VERSION);
  assert.deepEqual(first, second);
  assert.match(first.revision, /^[a-f0-9]{64}$/);
  assert.deepEqual(first.externalContextAcquisitionAnchorIds, [acquisitionInput.anchors[0].id]);
});

test("candidate revision uses the canonical stored statement and remains authorizable", () => {
  const padded = candidateRegistry([candidateInput({ statement: "  Canonical statement.  " })]);
  const candidate = padded.resolve(candidateInput().id);
  const canonical = candidateRegistry([
    candidateInput({ statement: "Canonical statement." }),
  ]).resolve(candidate.id);
  assert.equal(candidate.statement, "Canonical statement.");
  assert.equal(candidate.revision, canonical.revision);

  const authorization = createContextualAuthorizationRegistry(padded, [
    {
      id: "contextual-authorization:canonical-statement:v1",
      claimCandidateId: candidate.id,
      decision: "authorized",
      reviewer: { id: "reviewer:human-1" },
      reviewedAt: "2026-09-28T13:00:00Z",
    },
  ]);
  assert.deepEqual(authorization.authorizedClaims([candidate]), [candidate]);
  assert.deepEqual(
    authorization.authorizedClaims([{ ...candidate, statement: "Tampered statement." }]),
    [],
  );
});

test("authorization does not survive changed acquired evidence that reuses every ID", () => {
  const originalRegistry = candidateRegistry();
  const original = originalRegistry.resolve(candidateInput().id);
  const authorization = createContextualAuthorizationRegistry(originalRegistry, [
    {
      id: "contextual-authorization:acquired-evidence:v1",
      claimCandidateId: original.id,
      decision: "authorized",
      reviewer: { id: "reviewer:human-1" },
      reviewedAt: "2026-09-28T13:00:00Z",
    },
  ]);
  const changedContent = `B${content.slice(1)}`;
  const changedAcquisition = {
    ...acquisitionInput,
    content: { ...acquisitionInput.content, value: changedContent },
  };
  const changed = candidateRegistry(
    [candidateInput()],
    [need],
    [changedAcquisition, otherAcquisitionInput],
  ).resolve(original.id);

  assert.equal(changed.id, original.id);
  assert.equal(changed.statement, original.statement);
  assert.notEqual(
    changed.acquiredEvidence.checksum.value,
    original.acquiredEvidence.checksum.value,
  );
  assert.notDeepEqual(changed.acquiredEvidence.anchors, original.acquiredEvidence.anchors);
  assert.notEqual(changed.revision, original.revision);
  assert.deepEqual(authorization.authorizedClaims([changed]), []);
});

test("unknown contextual need, reference, acquisition, and anchor IDs fail explicitly", () => {
  for (const [overrides, expected] of [
    [{ contextualNeedId: "contextual-need:unknown" }, /Unknown contextual need/],
    [
      { externalContextReferenceId: "fixture-source:unknown" },
      /Unknown external context reference/,
    ],
    [
      { externalContextAcquisitionId: "fixture-acquisition:unknown" },
      /Unknown external context acquisition/,
    ],
    [
      { externalContextAcquisitionAnchorIds: ["fixture-anchor:unknown"] },
      /Unknown external context acquisition anchor/,
    ],
  ] as const)
    assert.throws(() => candidateRegistry([candidateInput(overrides)]), expected);
});

test("cross-acquisition anchors, mismatched references, and article mismatches fail", () => {
  assert.throws(
    () =>
      candidateRegistry([
        candidateInput({
          externalContextAcquisitionAnchorIds: [otherAcquisitionInput.anchors[0].id],
        }),
      ]),
    /does not belong/,
  );
  assert.throws(
    () => candidateRegistry([candidateInput({ externalContextReferenceId: otherReference.id })]),
    /does not match/,
  );
  assert.throws(
    () => candidateRegistry([candidateInput({ articleId: "article:other" })]),
    /article does not match/,
  );
});

test("duplicate candidate and anchor IDs, empty statements, and anchorless claims fail", () => {
  assert.throws(
    () => candidateRegistry([candidateInput(), candidateInput()]),
    /Duplicate contextual claim/,
  );
  assert.throws(
    () =>
      candidateRegistry([
        candidateInput({
          externalContextAcquisitionAnchorIds: [
            acquisitionInput.anchors[0].id,
            acquisitionInput.anchors[0].id,
          ],
        }),
      ]),
    /Duplicate acquisition anchor/,
  );
  assert.throws(() => candidateRegistry([candidateInput({ statement: " " })]));
  assert.throws(() =>
    candidateRegistry([candidateInput({ externalContextAcquisitionAnchorIds: [] })]),
  );
});

test("only an explicit authorized decision recognizes the exact reviewed claim", () => {
  const candidates = candidateRegistry();
  const candidate = candidates.resolve(candidateInput().id);
  const authorized = createContextualAuthorizationRegistry(candidates, [
    {
      id: "contextual-authorization:synthetic-001:v1",
      claimCandidateId: candidate.id,
      decision: "authorized",
      reviewer: { id: "reviewer:human-1" },
      reviewedAt: "2026-09-28T13:00:00Z",
    },
  ]);
  assert.equal(
    authorized.resolve("contextual-authorization:synthetic-001:v1").schemaVersion,
    CONTEXTUAL_AUTHORIZATION_VERSION,
  );
  assert.deepEqual(authorized.authorizedClaims([candidate]), [candidate]);
  assert.deepEqual(
    createContextualAuthorizationRegistry(candidates, []).authorizedClaims([candidate]),
    [],
  );
});

test("rejection, a different claim from the same source, and post-review mutation stay unauthorized", () => {
  const candidates = candidateRegistry();
  const candidate = candidates.resolve(candidateInput().id);
  const rejected = createContextualAuthorizationRegistry(candidates, [
    {
      id: "contextual-authorization:rejected:v1",
      claimCandidateId: candidate.id,
      decision: "rejected",
      reviewer: { id: "reviewer:human-1" },
      reviewedAt: "2026-09-28T13:00:00Z",
    },
  ]);
  assert.deepEqual(rejected.authorizedClaims([candidate]), []);

  const authorized = createContextualAuthorizationRegistry(candidates, [
    {
      id: "contextual-authorization:authorized:v1",
      claimCandidateId: candidate.id,
      decision: "authorized",
      reviewer: { id: "reviewer:human-1" },
      reviewedAt: "2026-09-28T13:00:00Z",
    },
  ]);
  const differentClaim = candidateRegistry([
    candidateInput({
      id: "contextual-claim:synthetic-002:v1",
      statement: "A different claim from the same authorized source.",
    }),
  ]).resolve("contextual-claim:synthetic-002:v1");
  assert.deepEqual(authorized.authorizedClaims([differentClaim]), []);
  assert.deepEqual(
    authorized.authorizedClaims([{ ...candidate, statement: "Changed after review." }]),
    [],
  );
});

test("a reference string alone cannot form authorization or scientific output", () => {
  assert.equal(contextualAuthorizationSchema.safeParse(reference.id).success, false);
  assert.equal(
    contextualClaimCandidateSchema.safeParse({ externalContextReferenceId: reference.id }).success,
    false,
  );
  const authorizationKeys = Object.keys(contextualAuthorizationSchema.shape);
  assert.equal(authorizationKeys.includes("facts"), false);
  assert.equal(authorizationKeys.includes("claims"), false);
  assert.equal(authorizationKeys.includes("contextualMaterial"), false);
  assert.equal(authorizationKeys.includes("ContextualScientificMaterial"), false);
});

test("the boundary is offline and has no provider, AI, persistence, or network integration", () => {
  assert.equal(checksumContent(content).length, 64);
  const implementation = readFileSync(
    new URL("./contextual-authorization.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    implementation,
    /OpenAI|provider|fetch\(|Supabase|ContextualScientificMaterial|ScientificFact/,
  );
});
