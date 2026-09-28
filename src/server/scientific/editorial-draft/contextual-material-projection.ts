import { createHash } from "node:crypto";
import type {
  ContextualClaimCandidate,
  createContextualAuthorizationRegistry,
} from "../knowledge-representation/contextual-authorization";
import {
  CONTEXTUAL_SCIENTIFIC_MATERIAL_VERSION,
  contextualScientificMaterialSchema,
  type ContextualScientificMaterial,
} from "./contracts";

type AuthorizationRegistry = ReturnType<typeof createContextualAuthorizationRegistry>;

export interface ProjectContextualScientificMaterialInput {
  authorizationRegistry: AuthorizationRegistry;
  currentCandidates: readonly ContextualClaimCandidate[];
}

export interface ContextualScientificMaterialProjection {
  contextualMaterial: ContextualScientificMaterial[];
  authorizedExternalContextReferenceIds: string[];
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function materialId(
  articleId: string,
  editorialPurpose: ContextualClaimCandidate["editorialPurpose"],
  candidates: readonly ContextualClaimCandidate[],
) {
  const identity = {
    schemaVersion: CONTEXTUAL_SCIENTIFIC_MATERIAL_VERSION,
    articleId,
    editorialPurpose,
    claims: candidates.map(({ id, revision }) => ({ id, revision })),
  };
  const digest = createHash("sha256").update(JSON.stringify(identity), "utf8").digest("hex");
  return `contextual-material:${digest}`;
}

/**
 * Projects only claims accepted by the Phase 1.4 fail-closed authorization boundary. The returned
 * material is an editorial envelope; candidate, acquired evidence, and authorization remain the
 * upstream authority.
 */
export function projectAuthorizedContextualScientificMaterial(
  input: ProjectContextualScientificMaterialInput,
): ContextualScientificMaterialProjection {
  const authorized = input.authorizationRegistry
    .authorizedClaims(input.currentCandidates)
    .sort((left, right) => compareText(left.id, right.id));
  const claimIds = new Set<string>();
  for (const candidate of authorized) {
    if (claimIds.has(candidate.id))
      throw new Error(`Duplicate authorized contextual claim candidate ID: ${candidate.id}`);
    claimIds.add(candidate.id);
  }

  const groups = new Map<string, ContextualClaimCandidate[]>();
  for (const candidate of authorized) {
    const key = JSON.stringify([candidate.articleId, candidate.editorialPurpose]);
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const contextualMaterial = [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, candidates]) => {
      const [{ articleId, editorialPurpose }] = candidates;
      return contextualScientificMaterialSchema.parse({
        schemaVersion: CONTEXTUAL_SCIENTIFIC_MATERIAL_VERSION,
        id: materialId(articleId, editorialPurpose, candidates),
        articleId,
        claims: candidates.map((candidate) => ({
          id: candidate.id,
          statement: candidate.statement,
          provenance: {
            sourceDocumentIds: [],
            evidenceAnchorIds: [],
            externalContextReferenceIds: [candidate.externalContextReferenceId],
          },
        })),
      });
    });

  const materialIds = new Set<string>();
  for (const material of contextualMaterial) {
    if (materialIds.has(material.id))
      throw new Error(`Duplicate projected contextual material ID: ${material.id}`);
    materialIds.add(material.id);
  }

  const authorizedExternalContextReferenceIds = [
    ...new Set(
      contextualMaterial.flatMap((material) =>
        material.claims.flatMap((claim) => claim.provenance.externalContextReferenceIds),
      ),
    ),
  ].sort(compareText);

  return { contextualMaterial, authorizedExternalContextReferenceIds };
}
