import "../server-only";
import type { ScientificSummary } from "./contract";

export interface SummaryInput {
  articleId: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string | null;
  publishedAt: string | null;
  publicationTypes: string[];
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  keywords: string[];
  meshTerms: string[];
  studyType: string | null;
  evidenceLevel: string | null;
  sourceScope: "abstract_and_metadata";
}
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}
export interface ProviderResult {
  summary: unknown;
  usage?: TokenUsage;
  metadata?: Record<string, string | number | boolean | null>;
}
export interface ProviderConfig {
  model: string;
  maxOutputTokens: number;
  promptVersion: string;
  schemaVersion: string;
  timeoutMs: number;
}
export interface ScientificSummaryProvider {
  readonly id: string;
  generateScientificSummary(input: SummaryInput, config: ProviderConfig): Promise<ProviderResult>;
}
export type ValidProviderResult = Omit<ProviderResult, "summary"> & { summary: ScientificSummary };

export type ProviderErrorCode =
  | "timeout"
  | "rate_limit"
  | "transient"
  | "permanent"
  | "invalid_output"
  | "fidelity_validation"
  | "configuration"
  | "ineligible";
export class SummaryProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}
