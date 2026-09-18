import "../server-only";

export interface SummaryRuntimeConfig {
  enabled: boolean;
  provider: string;
  model: string;
  maxInputCharacters: number;
  maxOutputTokens: number;
  maxAttempts: number;
}
export function loadSummaryConfig(env: NodeJS.ProcessEnv = process.env): SummaryRuntimeConfig {
  return {
    enabled: env.AI_SUMMARY_ENABLED === "true",
    provider: env.AI_SUMMARY_PROVIDER ?? "fake",
    model: env.AI_SUMMARY_MODEL ?? "fake-v1",
    maxInputCharacters: Number(env.AI_SUMMARY_MAX_INPUT_CHARS ?? 30_000),
    maxOutputTokens: Number(env.AI_SUMMARY_MAX_OUTPUT_TOKENS ?? 2_000),
    maxAttempts: Number(env.AI_SUMMARY_MAX_ATTEMPTS ?? 3),
  };
}
