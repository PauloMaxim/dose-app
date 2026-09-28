import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  contextualNeedId,
  createContextualAuthorizationRegistry,
  createContextualClaimCandidateRegistry,
  type ContextualAuthorizationInput,
  type ContextualClaimCandidate,
  type ContextualClaimCandidateInput,
} from "../knowledge-representation/contextual-authorization";
import type { ContextualNeed } from "../knowledge-representation/contextual-need";
import {
  createExternalContextAcquisitionRegistry,
  type ExternalContextAcquisitionInput,
} from "../knowledge-representation/external-context-acquisition";
import {
  createExternalContextReferenceRegistry,
  externalContextReferenceSchema,
} from "../knowledge-representation/external-context-reference";
import { contextualScientificMaterialSchema } from "./contracts";
import { projectAuthorizedContextualScientificMaterial } from "./contextual-material-projection";
import { deriveEditorialScientificAuthority } from "./scientific-authority";
import { validateContextualScientificMaterialInput } from "./validation";

const need: ContextualNeed = {
  version: "contextual-need.v1",
  articleId: "article:synthetic-a",
  subject: { kind: "endpoint_measure", endpointId: "endpoint-a", name: "A", measure: "Scale A" },
  supportingFactIds: ["fact:a", "fact:b"],
  evidenceAnchorIds: ["article-anchor:a"],
  detectedGap: "endpoint_measure_definition_not_structured",
  contextualQuestion: "What does synthetic Scale A measure?",
  editorialPurpose: "explain_endpoint_measure",
  method: { name: "central-endpoint-structural-gap", version: "1" },
  status: "candidate",
};

const references = ["reference:alpha", "reference:beta", "reference:unused"].map((id) =>
  externalContextReferenceSchema.parse({
    schemaVersion: "external-context-reference.v1",
    id,
    sourceClass: "regulatory_or_institutional_document",
    provider: "synthetic-offline-fixture",
    canonicalIdentifier: { scheme: "synthetic", value: id },
    canonicalLocator: `https://example.invalid/${id}`,
    title: `Synthetic source ${id}`,
  }),
);
const content = "Alpha evidence. Beta evidence. Unused evidence.";
const acquisitionInputs: ExternalContextAcquisitionInput[] = references.map((reference, index) => {
  const excerpts = ["Alpha evidence.", "Beta evidence.", "Unused evidence."];
  const starts = [0, 16, 31];
  return {
    id: `acquisition:synthetic-${index}`,
    externalContextReferenceId: reference.id,
    retrievedAt: "2026-09-28T12:00:00Z",
    contentScope: "excerpt",
    accessAndLicensing: { accessStatus: "publicly_accessible", license: { status: "unknown" } },
    acquisitionMethod: { name: "manual_supplied_content", version: "1" },
    content: { mediaType: "text/plain", value: content },
    anchors: [
      {
        id: `acquisition-anchor:synthetic-${index}`,
        locator: {
          kind: "unicode_code_point_range",
          start: starts[index],
          end: starts[index] + excerpts[index].length,
        },
      },
    ],
  };
});

function build(
  candidateInputs: ContextualClaimCandidateInput[],
  authorizations: ContextualAuthorizationInput[],
  needs: readonly ContextualNeed[] = [need],
  acquisitions: readonly ExternalContextAcquisitionInput[] = acquisitionInputs,
) {
  const referenceRegistry = createExternalContextReferenceRegistry(references);
  const acquisitionRegistry = createExternalContextAcquisitionRegistry(
    referenceRegistry,
    acquisitions,
  );
  const candidateRegistry = createContextualClaimCandidateRegistry(
    needs,
    referenceRegistry,
    acquisitionRegistry,
    candidateInputs,
  );
  const currentCandidates = candidateInputs.map(({ id }) => candidateRegistry.resolve(id));
  return {
    currentCandidates,
    authorizationRegistry: createContextualAuthorizationRegistry(candidateRegistry, authorizations),
  };
}

function candidate(
  id: string,
  referenceIndex = 0,
  overrides: Partial<ContextualClaimCandidateInput> = {},
): ContextualClaimCandidateInput {
  return {
    id,
    articleId: need.articleId,
    contextualNeedId: contextualNeedId(need),
    externalContextReferenceId: references[referenceIndex].id,
    externalContextAcquisitionId: acquisitionInputs[referenceIndex].id,
    externalContextAcquisitionAnchorIds: [acquisitionInputs[referenceIndex].anchors[0].id],
    statement: `Canonical synthetic statement ${id}.`,
    ...overrides,
  };
}

function decision(
  id: string,
  claimCandidateId: string,
  value: "authorized" | "rejected" = "authorized",
): ContextualAuthorizationInput {
  return {
    id,
    claimCandidateId,
    decision: value,
    reviewer: { id: "reviewer:synthetic-human" },
    reviewedAt: "2026-09-28T13:00:00Z",
  };
}

test("projects only exact current explicitly authorized claims and derives the allowlist", () => {
  const inputs = [
    candidate("claim:authorized", 1),
    candidate("claim:rejected", 0),
    candidate("claim:unreviewed", 2),
  ];
  const boundaries = build(inputs, [
    decision("authorization:authorized", "claim:authorized"),
    decision("authorization:rejected", "claim:rejected", "rejected"),
  ]);
  const projected = projectAuthorizedContextualScientificMaterial(boundaries);

  assert.deepEqual(projected.authorizedExternalContextReferenceIds, ["reference:beta"]);
  assert.equal(projected.contextualMaterial.length, 1);
  assert.deepEqual(projected.contextualMaterial[0].claims, [
    {
      id: "claim:authorized",
      statement: "Canonical synthetic statement claim:authorized.",
      provenance: {
        sourceDocumentIds: [],
        evidenceAnchorIds: [],
        externalContextReferenceIds: ["reference:beta"],
      },
    },
  ]);
  assert.equal(projected.contextualMaterial[0].articleId, need.articleId);
  assert.equal("epistemicStatus" in projected.contextualMaterial[0].claims[0], false);
  assert.equal(
    contextualScientificMaterialSchema.safeParse(projected.contextualMaterial[0]).success,
    true,
  );
});

test("post-authorization candidate, acquired evidence, and contextual need changes fail closed", () => {
  const input = candidate("claim:mutable");
  const original = build([input], [decision("authorization:mutable", input.id)]);
  const originalCandidate = original.currentCandidates[0];
  const changedCandidate = { ...originalCandidate, statement: "Changed after review." };
  assert.deepEqual(
    projectAuthorizedContextualScientificMaterial({
      authorizationRegistry: original.authorizationRegistry,
      currentCandidates: [changedCandidate],
    }).contextualMaterial,
    [],
  );

  const changedContent = `Omega${content.slice(5)}`;
  const changedEvidence = build(
    [input],
    [],
    [need],
    [
      { ...acquisitionInputs[0], content: { mediaType: "text/plain", value: changedContent } },
      ...acquisitionInputs.slice(1),
    ],
  ).currentCandidates[0];
  assert.deepEqual(
    projectAuthorizedContextualScientificMaterial({
      authorizationRegistry: original.authorizationRegistry,
      currentCandidates: [changedEvidence],
    }).contextualMaterial,
    [],
  );

  const alteredNeed = { ...need, contextualQuestion: "What changed about synthetic Scale A?" };
  const changedNeedCandidate = build(
    [candidate(input.id, 0, { contextualNeedId: contextualNeedId(alteredNeed) })],
    [],
    [alteredNeed],
  ).currentCandidates[0];
  assert.deepEqual(
    projectAuthorizedContextualScientificMaterial({
      authorizationRegistry: original.authorizationRegistry,
      currentCandidates: [changedNeedCandidate],
    }).contextualMaterial,
    [],
  );
});

test("authorization is claim-exact even when another claim uses the same reference", () => {
  const first = candidate("claim:same-reference-a");
  const second = candidate("claim:same-reference-b");
  const boundaries = build([first, second], [decision("authorization:same-reference-a", first.id)]);
  const projected = projectAuthorizedContextualScientificMaterial(boundaries);
  assert.deepEqual(
    projected.contextualMaterial[0].claims.map(({ id }) => id),
    [first.id],
  );
  assert.deepEqual(projected.authorizedExternalContextReferenceIds, [references[0].id]);
});

test("groups deterministically by article and editorial purpose without mixing articles", () => {
  const otherNeed = { ...need, articleId: "article:synthetic-b" };
  const first = candidate("claim:article-a");
  const second = candidate("claim:article-b", 1, {
    articleId: otherNeed.articleId,
    contextualNeedId: contextualNeedId(otherNeed),
  });
  const makeProjection = (inputs: ContextualClaimCandidateInput[]) => {
    const boundaries = build(
      inputs,
      [
        decision("authorization:article-a", first.id),
        decision("authorization:article-b", second.id),
      ],
      [need, otherNeed],
    );
    return projectAuthorizedContextualScientificMaterial(boundaries);
  };
  const forward = makeProjection([first, second]);
  const reversed = makeProjection([second, first]);
  assert.deepEqual(forward, reversed);
  assert.equal(forward.contextualMaterial.length, 2);
  assert.deepEqual(
    forward.contextualMaterial.map(({ articleId }) => articleId),
    [need.articleId, otherNeed.articleId],
  );
  assert.ok(forward.contextualMaterial.every(({ claims }) => claims.length === 1));
  assert.ok(
    forward.contextualMaterial.every(({ id }) => /^contextual-material:[a-f0-9]{64}$/.test(id)),
  );
});

test("deduplicates reference IDs only after exact claims are authorized", () => {
  const inputs = [candidate("claim:dedupe-b"), candidate("claim:dedupe-a")];
  const projected = projectAuthorizedContextualScientificMaterial(
    build(inputs, [
      decision("authorization:dedupe-b", inputs[0].id),
      decision("authorization:dedupe-a", inputs[1].id),
    ]),
  );
  assert.deepEqual(projected.authorizedExternalContextReferenceIds, [references[0].id]);
  assert.deepEqual(
    projected.contextualMaterial[0].claims.map(({ id }) => id),
    ["claim:dedupe-a", "claim:dedupe-b"],
  );
});

test("duplicate candidate, authorized claim, and material identities fail explicitly", () => {
  assert.throws(
    () => build([candidate("claim:duplicate"), candidate("claim:duplicate")], []),
    /Duplicate contextual claim candidate ID/,
  );
  const input = candidate("claim:twice-authorized");
  const boundaries = build(
    [input],
    [decision("authorization:first", input.id), decision("authorization:second", input.id)],
  );
  assert.throws(
    () => projectAuthorizedContextualScientificMaterial(boundaries),
    /Duplicate authorized contextual claim candidate ID/,
  );
});

test("projected bundle passes the existing contextual preflight with synthetic compatible inputs", () => {
  const input = candidate("claim:preflight");
  const projected = projectAuthorizedContextualScientificMaterial(
    build([input], [decision("authorization:preflight", input.id)]),
  );
  const articleArtifacts = {
    sourceSet: { articleId: need.articleId, sourceDocuments: [] },
    evidenceSet: { articleId: need.articleId, anchors: [] },
    factSet: { articleId: need.articleId },
    interpretationArtifact: { articleId: need.articleId },
  };
  assert.deepEqual(
    validateContextualScientificMaterialInput({
      ...articleArtifacts,
      ...projected,
    } as unknown as Parameters<typeof validateContextualScientificMaterialInput>[0]),
    { valid: true, errors: [] },
  );
});

test("projection cannot accept an arbitrary allowlist or create scientific authority", () => {
  const input = candidate("claim:lateral-context");
  const boundaries = build([input], [decision("authorization:lateral-context", input.id)]);
  const before = deriveEditorialScientificAuthority(
    { facts: [] } as never,
    { claims: [] } as never,
  );
  const projected = projectAuthorizedContextualScientificMaterial(boundaries);
  const after = deriveEditorialScientificAuthority({ facts: [] } as never, { claims: [] } as never);
  assert.deepEqual(after, before);
  assert.equal("authorizedExternalContextReferenceIds" in boundaries, false);
  assert.equal("quantitativeClaims" in projected, false);
  assert.equal("inferenceBoundaries" in projected, false);
  assert.equal("facts" in projected, false);
});

test("projection remains offline and contains no provider, AI, persistence, or network integration", () => {
  const implementation = readFileSync(
    new URL("./contextual-material-projection.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(implementation, /OpenAI|provider|fetch\(|Supabase|Vercel|ScientificFact/);
});
