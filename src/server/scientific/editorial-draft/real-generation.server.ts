import "../server-only";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_SCIENTIFIC_EDITORIAL_MODEL,
  loadScientificEditorialConfig,
  ScientificEditorialConfigurationError,
} from "./config.server";
import {
  ValidatedScientificEditorialDraftGenerator,
  type GenerateEditorialDraftInput,
} from "./generator";
import {
  OpenAIScientificEditorialProvider,
  openAIEditorialFetchTransport,
  ScientificEditorialProviderError,
  type OpenAIEditorialTransport,
  type ScientificEditorialProviderMetrics,
} from "./openai.server";
import { SCIENTIFIC_EDITORIAL_PROMPT_VERSION } from "./prompt";
import type { EditorialDraftValidationIssue } from "./validation";
import type { ScientificEditorialDraft } from "./contracts";
import { DOSE_PROGRESSIVE_EDITORIAL_PROFILE } from "./profile";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "../knowledge-representation/pmid-42717033.fixture";

export const SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID = "pmid:42717033" as const;

export interface RealEditorialGenerationRequest {
  articleId: string;
  confirmRealGeneration: boolean;
}

export type RealEditorialGenerationResult = {
  generationId: string;
  articleId: string;
  model: string;
  promptVersion: string;
  startedAt: string;
  durationMs: number;
  usage?: ScientificEditorialProviderMetrics["usage"];
  responseModel?: string;
  serviceTier?: string;
  responseId?: string;
  responseStatus?: string;
  incompleteReason?: string;
  validationStatus: "structurally_valid" | "rejected" | "not_run";
  validationErrors: EditorialDraftValidationIssue[];
  draft?: ScientificEditorialDraft;
  /** Schema-valid candidate; deterministically rejected, unapproved, and pending human review. */
  candidateDraft?: ScientificEditorialDraft;
  error?: { code: string; message: string };
};

export interface RealEditorialGenerationDependencies {
  env?: NodeJS.ProcessEnv;
  transport?: OpenAIEditorialTransport;
  now?: () => number;
  generationId?: () => string;
  loadInput?: (
    articleId: typeof SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID,
  ) => GenerateEditorialDraftInput;
}

function canaryInput(): GenerateEditorialDraftInput {
  return {
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretationArtifact: pmid42717033Interpretation,
    contextualMaterial: [],
    editorialProfile: DOSE_PROGRESSIVE_EDITORIAL_PROFILE,
  };
}

/** Explicit one-shot operation. It neither persists nor publishes its result. */
export async function runRealEditorialGeneration(
  request: RealEditorialGenerationRequest,
  dependencies: RealEditorialGenerationDependencies = {},
): Promise<RealEditorialGenerationResult> {
  if (request.confirmRealGeneration !== true)
    throw new ScientificEditorialProviderError(
      "provider_error",
      "Explicit real-generation confirmation is required",
    );
  if (request.articleId !== SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID)
    throw new ScientificEditorialProviderError(
      "provider_error",
      "Article is not authorized for real editorial generation",
    );

  const now = dependencies.now ?? Date.now;
  const started = now();
  const startedAt = new Date(started).toISOString();
  const runtimeEnv = dependencies.env ?? process.env;
  const model = runtimeEnv.SCIENTIFIC_EDITORIAL_MODEL?.trim() || DEFAULT_SCIENTIFIC_EDITORIAL_MODEL;
  const base = {
    generationId: (dependencies.generationId ?? randomUUID)(),
    articleId: request.articleId,
    model,
    promptVersion: SCIENTIFIC_EDITORIAL_PROMPT_VERSION,
    startedAt,
  };
  let config;
  try {
    config = loadScientificEditorialConfig(runtimeEnv);
  } catch (error) {
    const message =
      error instanceof ScientificEditorialConfigurationError
        ? error.message
        : "Scientific editorial generation is not configured";
    return {
      ...base,
      durationMs: Math.max(0, now() - started),
      validationStatus: "not_run",
      validationErrors: [],
      error: { code: "configuration", message },
    };
  }
  let metrics: ScientificEditorialProviderMetrics | undefined;
  const observedMetrics = () => ({
    usage: metrics?.usage,
    responseModel: metrics?.responseModel,
    serviceTier: metrics?.serviceTier,
    responseId: metrics?.responseId,
    responseStatus: metrics?.status,
    incompleteReason: metrics?.incompleteReason,
  });
  const provider = new OpenAIScientificEditorialProvider(
    dependencies.transport ?? openAIEditorialFetchTransport,
    config,
    (observed) => {
      metrics = observed;
    },
  );
  try {
    const input = (dependencies.loadInput ?? canaryInput)(SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID);
    const result = await new ValidatedScientificEditorialDraftGenerator(provider).generate(input);
    const durationMs = Math.max(0, now() - started);
    if (!result.ok)
      return {
        ...base,
        durationMs,
        ...observedMetrics(),
        validationStatus: "rejected",
        validationErrors: result.errors,
        candidateDraft: result.candidateDraft,
      };
    return {
      ...base,
      durationMs,
      ...observedMetrics(),
      validationStatus: "structurally_valid",
      validationErrors: [],
      draft: result.draft,
    };
  } catch (error) {
    const typed =
      error instanceof ScientificEditorialProviderError
        ? error
        : new ScientificEditorialProviderError("provider_error", "Editorial provider failed");
    return {
      ...base,
      durationMs: Math.max(0, now() - started),
      ...observedMetrics(),
      validationStatus: "not_run",
      validationErrors: [],
      error: { code: typed.code, message: typed.message },
    };
  }
}
