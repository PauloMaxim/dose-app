import type {
  RCTScientificFactSet,
  ScientificEvidenceSet,
  ScientificInterpretationArtifact,
  ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import type { ContextualScientificMaterial, ScientificEditorialDraft } from "./contracts";
import type { ScientificEditorialProvider } from "./provider.server";
import { SCIENTIFIC_EDITORIAL_PROMPT_VERSION, SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT } from "./prompt";
import { validateScientificEditorialDraft, type EditorialDraftValidationIssue } from "./validation";

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

export type EditorialGenerationResult =
  | { ok: true; draft: ScientificEditorialDraft }
  | { ok: false; errors: EditorialDraftValidationIssue[] };

/** Generation is untrusted until the independent contract validator accepts the output. */
export class ValidatedScientificEditorialDraftGenerator {
  constructor(private readonly provider: ScientificEditorialProvider) {}

  async generate(input: GenerateEditorialDraftInput): Promise<EditorialGenerationResult> {
    const draft = await this.provider.generate({
      promptVersion: SCIENTIFIC_EDITORIAL_PROMPT_VERSION,
      systemPrompt: SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
      input,
    });
    const report = validateScientificEditorialDraft({
      draft,
      ...input,
    });
    if (!report.valid) return { ok: false, errors: report.errors };
    return { ok: true, draft: draft as ScientificEditorialDraft };
  }
}
