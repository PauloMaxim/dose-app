import type { ScientificSummary } from "./contract";
import {
  SummaryProviderError,
  type ProviderConfig,
  type ProviderResult,
  type ScientificSummaryProvider,
  type SummaryInput,
} from "./provider.server";

export type FakeMode = "success" | "timeout" | "rate_limit" | "transient" | "invalid";
export class FakeScientificSummaryProvider implements ScientificSummaryProvider {
  readonly id = "fake";
  calls = 0;
  constructor(
    public mode: FakeMode = "success",
    private readonly delayMs = 0,
    private readonly result?: ScientificSummary,
  ) {}
  async generateScientificSummary(
    input: SummaryInput,
    _config: ProviderConfig,
  ): Promise<ProviderResult> {
    this.calls++;
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    if (this.mode === "timeout") throw new SummaryProviderError("timeout", "Fake timeout", true);
    if (this.mode === "rate_limit")
      throw new SummaryProviderError("rate_limit", "Fake rate limit", true);
    if (this.mode === "transient")
      throw new SummaryProviderError("transient", "Fake transient error", true);
    if (this.mode === "invalid") return { summary: { shortSummary: "invalid" } };
    return {
      summary: this.result ?? validFakeSummary(input),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cachedTokens: 10 },
    };
  }
}
export function validFakeSummary(input: SummaryInput): ScientificSummary {
  return {
    shortSummary: input.title,
    objective: null,
    studyDesign: input.studyType,
    populationOrSample: null,
    methods: null,
    mainFindings: null,
    keyNumbers: [],
    authorsConclusion: null,
    limitations: null,
    practicalImplications: null,
    evidenceContext: input.evidenceLevel,
    cautions: null,
    technicalTerms: [],
    sourceScope: "abstract_and_metadata",
  };
}
