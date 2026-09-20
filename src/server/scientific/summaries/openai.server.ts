import "../server-only";
import { scientificSummaryJsonSchema } from "./contract";
import { SUMMARY_SYSTEM_PROMPT } from "./prompt";
import {
  SummaryProviderError,
  type ProviderConfig,
  type ProviderResult,
  type ScientificSummaryProvider,
  type SummaryInput,
} from "./provider.server";

export interface OpenAIResponsesTransport {
  create(
    request: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<{
    output_text?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      input_tokens_details?: { cached_tokens?: number };
    };
    id?: string;
  }>;
}

/** Transport is injected: importing or constructing this adapter never performs a request. */
export class OpenAIResponsesProvider implements ScientificSummaryProvider {
  readonly id = "openai";
  constructor(private readonly transport: OpenAIResponsesTransport) {}
  async generateScientificSummary(
    input: SummaryInput,
    config: ProviderConfig,
  ): Promise<ProviderResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      const response = await this.transport
        .create(
          {
            model: config.model,
            instructions: SUMMARY_SYSTEM_PROMPT,
            input: JSON.stringify(input),
            max_output_tokens: config.maxOutputTokens,
            text: {
              format: {
                type: "json_schema",
                name: "scientific_summary",
                strict: true,
                schema: scientificSummaryJsonSchema,
              },
            },
          },
          { signal: controller.signal },
        )
        .finally(() => clearTimeout(timeout));
      if (!response.output_text)
        throw new SummaryProviderError(
          "invalid_output",
          "OpenAI response contained no structured output",
          false,
        );
      let summary: unknown;
      try {
        summary = JSON.parse(response.output_text);
      } catch {
        throw new SummaryProviderError("invalid_output", "OpenAI response was not JSON", false);
      }
      const usage = response.usage
        ? {
            inputTokens: response.usage.input_tokens ?? 0,
            outputTokens: response.usage.output_tokens ?? 0,
            totalTokens: response.usage.total_tokens ?? 0,
            cachedTokens: response.usage.input_tokens_details?.cached_tokens,
          }
        : undefined;
      return { summary, usage, metadata: { responseId: response.id ?? null } };
    } catch (error) {
      if (error instanceof SummaryProviderError) throw error;
      if ((error as { name?: string }).name === "AbortError")
        throw new SummaryProviderError("timeout", "OpenAI request timed out", true);
      const status = (error as { status?: number }).status;
      if (status === 429) throw new SummaryProviderError("rate_limit", "OpenAI rate limit", true);
      if (status && status >= 400 && status < 500)
        throw new SummaryProviderError("permanent", "OpenAI rejected the request", false);
      throw new SummaryProviderError("transient", "OpenAI transport failure", true);
    }
  }
}
