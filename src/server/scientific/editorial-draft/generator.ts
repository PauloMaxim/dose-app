import type {
  RCTScientificFactSet,
  ScientificEvidenceSet,
  ScientificInterpretationArtifact,
  ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import {
  contextualScientificMaterialSchema,
  scientificEditorialDraftSchema,
  type EditorialGenerationProfile,
  type ScientificEditorialDraft,
} from "./contracts";
import type {
  ScientificEditorialProvider,
  ScientificEditorialProviderRequest,
} from "./provider.server";
import {
  buildScientificEditorialSystemPrompt,
  SCIENTIFIC_EDITORIAL_PROMPT_VERSION,
} from "./prompt";
import { deriveEditorialScientificAuthority } from "./scientific-authority";
import {
  validateContextualScientificMaterialInput,
  validateScientificEditorialDraft,
  type EditorialDraftValidationIssue,
} from "./validation";

/** Boundary only: implementations must not treat generated prose as scientific authority. */
export interface GenerateEditorialDraftInput {
  sourceSet: ScientificSourceSet;
  evidenceSet: ScientificEvidenceSet;
  factSet: RCTScientificFactSet;
  interpretationArtifact: ScientificInterpretationArtifact;
  contextualMaterial: unknown[];
  /** Explicit acquisition-boundary allowlist; it does not make references draft grounding. */
  authorizedExternalContextReferenceIds: string[];
  editorialProfile: EditorialGenerationProfile;
}

/** A future provider must return a pending draft and then pass it through independent validation. */
export interface ScientificEditorialDraftGenerator {
  generateEditorialDraft(input: GenerateEditorialDraftInput): Promise<ScientificEditorialDraft>;
}

export type EditorialGenerationResult =
  | {
      ok: true;
      /** Deterministic checks passed; prose is not semantically approved and remains pending. */
      deterministicValidation: "passed";
      draft: ScientificEditorialDraft;
    }
  | {
      ok: false;
      errors: EditorialDraftValidationIssue[];
      /** Schema-valid provider output that failed deterministic checks and remains pending review. */
      candidateDraft?: ScientificEditorialDraft;
    };

export function createScientificEditorialProviderRequest(
  input: GenerateEditorialDraftInput,
): ScientificEditorialProviderRequest {
  const validatedInput = {
    ...input,
    contextualMaterial: input.contextualMaterial.map((material) =>
      contextualScientificMaterialSchema.parse(material),
    ),
  };
  return {
    promptVersion: SCIENTIFIC_EDITORIAL_PROMPT_VERSION,
    systemPrompt: buildScientificEditorialSystemPrompt(input.editorialProfile),
    input: validatedInput,
    scientificAuthority: deriveEditorialScientificAuthority(
      validatedInput.factSet,
      validatedInput.interpretationArtifact,
    ),
  };
}

/** Passing deterministic validation never replaces mandatory human semantic review. */
export class ValidatedScientificEditorialDraftGenerator {
  constructor(private readonly provider: ScientificEditorialProvider) {}

  async generate(input: GenerateEditorialDraftInput): Promise<EditorialGenerationResult> {
    const contextReport = validateContextualScientificMaterialInput(input);
    if (!contextReport.valid) return { ok: false, errors: contextReport.errors };
    const providerRequest = createScientificEditorialProviderRequest(input);
    const validatedInput = providerRequest.input;
    const output = await this.provider.generate(providerRequest);
    const parsed = scientificEditorialDraftSchema.safeParse(output);
    const report = validateScientificEditorialDraft({
      draft: output,
      ...validatedInput,
    });
    if (!report.valid)
      return {
        ok: false,
        errors: report.errors,
        ...(parsed.success ? { candidateDraft: parsed.data } : {}),
      };
    if (!parsed.success) return { ok: false, errors: report.errors };
    return { ok: true, deterministicValidation: "passed", draft: parsed.data };
  }
}
