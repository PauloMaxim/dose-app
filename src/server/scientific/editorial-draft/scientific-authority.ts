import type {
  RCTScientificFactSet,
  ScientificInterpretationArtifact,
} from "../knowledge-representation/editorial-pipeline";
import type { ScientificFact } from "../knowledge-representation/contracts";
import { SCIENTIFIC_EDITORIAL_STRUCTURAL_QUANTITATIVE_UNITS } from "./contracts";

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
  /** Complete allowlist for quantitativeClaims, derived only from typed fact quantities. */
  quantitativeClaims: Array<{
    factId: string;
    value: number;
    unit: string;
  }>;
}

interface FactQuantity {
  value: number;
  unit: string;
}

function availableValue<T>(availability: { status: string; value?: T }): T | undefined {
  return availability.status === "available" ? availability.value : undefined;
}

/** Extracts material quantities, never numbers embedded only in scientific nomenclature. */
function factQuantities(fact: ScientificFact): FactQuantity[] {
  const value = availableValue(fact.availability);
  if (!value) return [];
  const structuralUnits = SCIENTIFIC_EDITORIAL_STRUCTURAL_QUANTITATIVE_UNITS;
  switch (value.type) {
    case "population_sample_size":
      return [{ value: value.value, unit: structuralUnits.participantCount }];
    case "population_characteristic": {
      const denominator = availableValue(value.denominator);
      return [
        value.value,
        ...(denominator === undefined
          ? []
          : [{ value: denominator, unit: structuralUnits.participantCount }]),
      ];
    }
    case "eligibility":
      return [value.value];
    case "arm": {
      const dose = availableValue(value.dose);
      return [
        ...(dose ? [dose] : []),
        ...(value.randomizedSampleSize === undefined
          ? []
          : [{ value: value.randomizedSampleSize, unit: structuralUnits.participantCount }]),
      ];
    }
    case "allocation_ratio":
      return value.allocations.map(({ parts }) => ({
        value: parts,
        unit: structuralUnits.allocationPart,
      }));
    case "treatment_duration":
      return [value.duration];
    case "endpoint_timepoint":
    case "endpoint":
      return [value.timepoint];
    case "result": {
      const interval = availableValue(value.estimate.confidenceInterval);
      const pValue = availableValue(value.estimate.pValue);
      return [
        { value: value.estimate.value, unit: value.estimate.unit },
        ...(interval
          ? [
              { value: interval.lower, unit: value.estimate.unit },
              { value: interval.upper, unit: value.estimate.unit },
              { value: interval.levelPercent, unit: structuralUnits.confidenceLevelPercent },
            ]
          : []),
        ...(pValue ? [{ value: pValue.value, unit: structuralUnits.pValue }] : []),
        value.timepoint,
      ];
    }
    case "arm_estimate": {
      const eventCount = availableValue(value.eventCount);
      const denominator = availableValue(value.denominator);
      return [
        { value: value.estimate.value, unit: value.estimate.unit },
        ...(eventCount === undefined
          ? []
          : [{ value: eventCount, unit: structuralUnits.participantCount }]),
        ...(denominator === undefined
          ? []
          : [{ value: denominator, unit: structuralUnits.participantCount }]),
        value.timepoint,
      ];
    }
    case "statistical_hypothesis": {
      const pValue = availableValue(value.pValue);
      return [
        value.margin,
        { value: value.confidenceLevelPercent, unit: structuralUnits.confidenceLevelPercent },
        ...(pValue ? [{ value: pValue.value, unit: structuralUnits.pValue }] : []),
      ];
    }
    case "safety_event": {
      const denominator = availableValue(value.denominator);
      return [
        value.frequency,
        ...(denominator === undefined
          ? []
          : [{ value: denominator, unit: structuralUnits.participantCount }]),
      ];
    }
    case "study_design_feature":
    case "blinding":
    case "phase":
    case "population_condition":
    case "safety_comparison":
    case "registry_identifier":
    case "mechanism_relation":
      return [];
  }
}

/** SOURCE → EVIDENCE → FACTS → INTERPRETATION remains scientific authority. */
export function deriveEditorialScientificAuthority(
  factSet: RCTScientificFactSet,
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
  return {
    inferenceBoundaries: [...boundaries.values()],
    quantitativeClaims: factSet.facts.flatMap((fact) =>
      factQuantities(fact).map((quantity) => ({ factId: fact.id, ...quantity })),
    ),
  };
}
