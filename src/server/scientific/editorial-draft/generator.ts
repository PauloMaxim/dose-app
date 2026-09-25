import type {
  RCTScientificFactSet,
  ScientificEvidenceSet,
  ScientificInterpretationArtifact,
  ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import type { ContextualScientificMaterial, ScientificEditorialDraft } from "./contracts";

/** Boundary only: implementations must not treat generated prose as scientific authority. */
export interface GenerateEditorialDraftInput {
  sourceSet: ScientificSourceSet;
  evidenceSet: ScientificEvidenceSet;
  factSet: RCTScientificFactSet;
  interpretationArtifact: ScientificInterpretationArtifact;
  contextualMaterial: ContextualScientificMaterial[];
}

/** A future provider must return a pending draft and then pass it through independent validation. */
export interface ScientificEditorialDraftGenerator {
  generateEditorialDraft(input: GenerateEditorialDraftInput): Promise<ScientificEditorialDraft>;
}
