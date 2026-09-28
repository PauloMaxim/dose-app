import { createHash } from "node:crypto";
import { z } from "zod";
import { contextualNeedSchema, type ContextualNeed } from "./contextual-need";
import type { createExternalContextAcquisitionRegistry } from "./external-context-acquisition";
import type { createExternalContextReferenceRegistry } from "./external-context-reference";

export const CONTEXTUAL_CLAIM_CANDIDATE_VERSION = "contextual-claim-candidate.v1" as const;
export const CONTEXTUAL_AUTHORIZATION_VERSION = "contextual-authorization.v1" as const;

const id = z.string().trim().min(1).max(500);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

const contextualClaimCandidateCoreSchema = z
  .object({
    schemaVersion: z.literal(CONTEXTUAL_CLAIM_CANDIDATE_VERSION),
    id,
    articleId: id,
    contextualNeedId: id,
    editorialPurpose: z.literal("explain_endpoint_measure"),
    externalContextReferenceId: id,
    externalContextAcquisitionId: id,
    externalContextAcquisitionAnchorIds: z.array(id).min(1),
    acquiredEvidence: z
      .object({
        checksum: z.object({ algorithm: z.literal("sha256"), value: sha256 }).strict(),
        anchors: z
          .array(
            z
              .object({
                schemaVersion: z.literal("external-context-acquisition-anchor.v1"),
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
              .strict(),
          )
          .min(1),
      })
      .strict(),
    statement: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const contextualClaimCandidateSchema = contextualClaimCandidateCoreSchema.extend({
  revision: sha256,
});

export type ContextualClaimCandidate = z.infer<typeof contextualClaimCandidateSchema>;

const authorizationScopeSchema = contextualClaimCandidateSchema
  .pick({
    articleId: true,
    contextualNeedId: true,
    editorialPurpose: true,
    externalContextReferenceId: true,
    externalContextAcquisitionId: true,
    externalContextAcquisitionAnchorIds: true,
  })
  .strict();

export const contextualAuthorizationSchema = z
  .object({
    schemaVersion: z.literal(CONTEXTUAL_AUTHORIZATION_VERSION),
    id,
    claimCandidateId: id,
    claimRevision: sha256,
    decision: z.enum(["authorized", "rejected"]),
    reviewer: z.object({ id }).strict(),
    reviewedAt: z.iso.datetime({ offset: true }),
    scope: authorizationScopeSchema,
  })
  .strict();

export type ContextualAuthorization = z.infer<typeof contextualAuthorizationSchema>;
type ReferenceRegistry = ReturnType<typeof createExternalContextReferenceRegistry>;
type AcquisitionRegistry = ReturnType<typeof createExternalContextAcquisitionRegistry>;

export interface ContextualClaimCandidateInput {
  id: string;
  articleId: string;
  contextualNeedId: string;
  externalContextReferenceId: string;
  externalContextAcquisitionId: string;
  externalContextAcquisitionAnchorIds: readonly string[];
  statement: string;
}

export interface ContextualAuthorizationInput {
  id: string;
  claimCandidateId: string;
  decision: ContextualAuthorization["decision"];
  reviewer: ContextualAuthorization["reviewer"];
  reviewedAt: string;
}

export function contextualNeedId(need: ContextualNeed) {
  const identity = [
    need.version,
    need.articleId,
    need.subject.kind,
    need.subject.endpointId,
    need.subject.name,
    need.subject.measure,
    [...need.supportingFactIds].sort(),
    [...need.evidenceAnchorIds].sort(),
    need.detectedGap,
    need.contextualQuestion,
    need.editorialPurpose,
    need.method.name,
    need.method.version,
    need.status,
  ];
  const revision = createHash("sha256").update(JSON.stringify(identity), "utf8").digest("hex");
  return `contextual-need:${need.articleId}:${need.subject.endpointId}:${revision}`;
}

type ContextualClaimCandidateCore = z.infer<typeof contextualClaimCandidateCoreSchema>;

function candidateRevision(candidate: ContextualClaimCandidateCore) {
  const identity = [
    candidate.schemaVersion,
    candidate.id,
    candidate.articleId,
    candidate.contextualNeedId,
    candidate.editorialPurpose,
    candidate.externalContextReferenceId,
    candidate.externalContextAcquisitionId,
    candidate.externalContextAcquisitionAnchorIds,
    candidate.acquiredEvidence.checksum.algorithm,
    candidate.acquiredEvidence.checksum.value,
    candidate.acquiredEvidence.anchors.map((anchor) => [
      anchor.schemaVersion,
      anchor.id,
      anchor.acquisitionId,
      anchor.locator.kind,
      anchor.locator.start,
      anchor.locator.end,
      anchor.excerpt,
    ]),
    candidate.statement,
  ];
  return createHash("sha256").update(JSON.stringify(identity), "utf8").digest("hex");
}

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} ID`);
}

export function createContextualClaimCandidateRegistry(
  contextualNeeds: readonly ContextualNeed[],
  referenceRegistry: ReferenceRegistry,
  acquisitionRegistry: AcquisitionRegistry,
  inputs: readonly ContextualClaimCandidateInput[],
) {
  const needs = new Map<string, ContextualNeed>();
  for (const inputNeed of contextualNeeds) {
    const need = contextualNeedSchema.parse(inputNeed);
    const needId = contextualNeedId(need);
    if (needs.has(needId)) throw new Error(`Duplicate contextual need ID: ${needId}`);
    needs.set(needId, structuredClone(need));
  }

  const candidates = new Map<string, ContextualClaimCandidate>();
  for (const input of inputs) {
    if (candidates.has(input.id))
      throw new Error(`Duplicate contextual claim candidate ID: ${input.id}`);
    assertUnique(input.externalContextAcquisitionAnchorIds, "acquisition anchor");
    const need = needs.get(input.contextualNeedId);
    if (!need) throw new Error(`Unknown contextual need ID: ${input.contextualNeedId}`);
    if (need.articleId !== input.articleId)
      throw new Error("Contextual claim candidate article does not match its contextual need");
    const reference = referenceRegistry.resolve(input.externalContextReferenceId);
    const acquisition = acquisitionRegistry.resolve(input.externalContextAcquisitionId);
    if (acquisition.externalContextReferenceId !== reference.id)
      throw new Error("External context acquisition does not match the supplied reference");
    const usedAnchors = input.externalContextAcquisitionAnchorIds.map((anchorId) => {
      const anchor = acquisitionRegistry.resolveAnchor(anchorId);
      if (anchor.acquisitionId !== acquisition.id)
        throw new Error(
          `External context acquisition anchor does not belong to acquisition: ${anchorId}`,
        );
      return anchor;
    });
    const core = contextualClaimCandidateCoreSchema.parse({
      schemaVersion: CONTEXTUAL_CLAIM_CANDIDATE_VERSION,
      ...input,
      externalContextAcquisitionAnchorIds: [...input.externalContextAcquisitionAnchorIds],
      editorialPurpose: need.editorialPurpose,
      acquiredEvidence: {
        checksum: acquisition.checksum,
        anchors: usedAnchors,
      },
    });
    const candidate = contextualClaimCandidateSchema.parse({
      ...core,
      revision: candidateRevision(core),
    });
    candidates.set(candidate.id, candidate);
  }

  return Object.freeze({
    resolve(id: string) {
      const candidate = candidates.get(id);
      if (!candidate) throw new Error(`Unknown contextual claim candidate ID: ${id}`);
      return contextualClaimCandidateSchema.parse(candidate);
    },
  });
}

type CandidateRegistry = ReturnType<typeof createContextualClaimCandidateRegistry>;

function scopeFor(candidate: ContextualClaimCandidate): ContextualAuthorization["scope"] {
  return {
    articleId: candidate.articleId,
    contextualNeedId: candidate.contextualNeedId,
    editorialPurpose: candidate.editorialPurpose,
    externalContextReferenceId: candidate.externalContextReferenceId,
    externalContextAcquisitionId: candidate.externalContextAcquisitionId,
    externalContextAcquisitionAnchorIds: [...candidate.externalContextAcquisitionAnchorIds],
  };
}

export function createContextualAuthorizationRegistry(
  candidateRegistry: CandidateRegistry,
  inputs: readonly ContextualAuthorizationInput[],
) {
  const authorizations = new Map<string, ContextualAuthorization>();
  for (const input of inputs) {
    if (authorizations.has(input.id))
      throw new Error(`Duplicate contextual authorization ID: ${input.id}`);
    const candidate = candidateRegistry.resolve(input.claimCandidateId);
    const authorization = contextualAuthorizationSchema.parse({
      schemaVersion: CONTEXTUAL_AUTHORIZATION_VERSION,
      ...input,
      claimRevision: candidate.revision,
      scope: scopeFor(candidate),
    });
    authorizations.set(authorization.id, authorization);
  }

  return Object.freeze({
    resolve(id: string) {
      const authorization = authorizations.get(id);
      if (!authorization) throw new Error(`Unknown contextual authorization ID: ${id}`);
      return contextualAuthorizationSchema.parse(authorization);
    },
    authorizedClaims(currentCandidates: readonly ContextualClaimCandidate[]) {
      const current = new Map<string, ContextualClaimCandidate>();
      for (const candidate of currentCandidates) {
        const parsed = contextualClaimCandidateSchema.parse(candidate);
        if (current.has(parsed.id))
          throw new Error(`Duplicate contextual claim candidate ID: ${parsed.id}`);
        current.set(parsed.id, parsed);
      }
      const result: ContextualClaimCandidate[] = [];
      for (const authorization of authorizations.values()) {
        if (authorization.decision !== "authorized") continue;
        const candidate = current.get(authorization.claimCandidateId);
        if (!candidate || candidate.revision !== authorization.claimRevision) continue;
        const { revision: _revision, ...candidateWithoutRevision } = candidate;
        if (candidateRevision(candidateWithoutRevision) !== candidate.revision) continue;
        if (JSON.stringify(scopeFor(candidate)) !== JSON.stringify(authorization.scope)) continue;
        result.push(contextualClaimCandidateSchema.parse(candidate));
      }
      return result;
    },
  });
}
