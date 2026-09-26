import "../server-only";

export const DEFAULT_SCIENTIFIC_EDITORIAL_MODEL = "gpt-4.1-mini";
export const DEFAULT_SCIENTIFIC_EDITORIAL_TIMEOUT_MS = 45_000;
export const DEFAULT_SCIENTIFIC_EDITORIAL_MAX_INPUT_CHARS = 120_000;
export const DEFAULT_SCIENTIFIC_EDITORIAL_MAX_OUTPUT_TOKENS = 8_000;

export interface ScientificEditorialRuntimeConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxInputCharacters: number;
  maxOutputTokens: number;
}

export class ScientificEditorialConfigurationError extends Error {
  readonly code = "configuration";
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

/** Reads secrets only when a future, explicitly confirmed operation is invoked. */
export function loadScientificEditorialConfig(
  env: NodeJS.ProcessEnv = process.env,
): ScientificEditorialRuntimeConfig {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    throw new ScientificEditorialConfigurationError(
      "OPENAI_API_KEY is required for scientific editorial generation",
    );
  return {
    apiKey,
    model: env.SCIENTIFIC_EDITORIAL_MODEL?.trim() || DEFAULT_SCIENTIFIC_EDITORIAL_MODEL,
    timeoutMs: boundedInteger(
      env.SCIENTIFIC_EDITORIAL_TIMEOUT_MS,
      DEFAULT_SCIENTIFIC_EDITORIAL_TIMEOUT_MS,
      1_000,
      120_000,
    ),
    maxInputCharacters: boundedInteger(
      env.SCIENTIFIC_EDITORIAL_MAX_INPUT_CHARS,
      DEFAULT_SCIENTIFIC_EDITORIAL_MAX_INPUT_CHARS,
      10_000,
      250_000,
    ),
    maxOutputTokens: boundedInteger(
      env.SCIENTIFIC_EDITORIAL_MAX_OUTPUT_TOKENS,
      DEFAULT_SCIENTIFIC_EDITORIAL_MAX_OUTPUT_TOKENS,
      1_000,
      16_000,
    ),
  };
}
