import type { ScientificInterpretationArtifact } from "../knowledge-representation/editorial-pipeline";

export const GLOBAL_EDITORIAL_INFERENCE_BOUNDARIES = [
  "do_not_infer_equivalence",
  "do_not_infer_superiority",
  "do_not_infer_causality",
  "do_not_recommend_treatment",
  "do_not_generalize_beyond_study",
  "do_not_claim_full_text_review",
] as const;

export interface EditorialScientificAuthority {
  /** Deterministically derived restrictions; provider output cannot add, remove, or reclassify them. */
  inferenceBoundaries: Array<{
    id: string;
    source: "global_contract" | "interpretation";
    interpretationClaimIds: string[];
  }>;
}

/** SOURCE → EVIDENCE → FACTS → INTERPRETATION remains scientific authority. */
export function deriveEditorialScientificAuthority(
  interpretation: ScientificInterpretationArtifact,
): EditorialScientificAuthority {
  const boundaries = new Map<
    string,
    { id: string; source: "global_contract" | "interpretation"; interpretationClaimIds: string[] }
  >();
  for (const id of GLOBAL_EDITORIAL_INFERENCE_BOUNDARIES)
    boundaries.set(id, { id, source: "global_contract", interpretationClaimIds: [] });
  for (const claim of interpretation.claims)
    for (const id of claim.prohibitedExtrapolations) {
      const current = boundaries.get(id);
      boundaries.set(id, {
        id,
        source: "interpretation",
        interpretationClaimIds: [
          ...new Set([...(current?.interpretationClaimIds ?? []), claim.id]),
        ],
      });
    }
  return { inferenceBoundaries: [...boundaries.values()] };
}
