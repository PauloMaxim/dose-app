import "../server-only";
import { scientificEditorialDraftJsonSchema } from "./contracts";
import type { ScientificEditorialRuntimeConfig } from "./config.server";
import type {
  ScientificEditorialProvider,
  ScientificEditorialProviderRequest,
} from "./provider.server";

export interface ScientificEditorialUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ScientificEditorialProviderMetrics {
  model: string;
  usage?: ScientificEditorialUsage;
  responseId?: string;
}

export class ScientificEditorialProviderError extends Error {
  constructor(
    public readonly code: "payload_too_large" | "timeout" | "provider_error" | "invalid_output",
    message: string,
  ) {
    super(message);
  }
}

export interface OpenAIEditorialTransport {
  create(
    request: Record<string, unknown>,
    options: { signal: AbortSignal; apiKey: string },
  ): Promise<{
    id?: string;
    output_text?: string;
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  }>;
}

export const openAIEditorialFetchTransport: OpenAIEditorialTransport = {
  async create(request, { signal, apiKey }) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
    const body = (await response.json()) as {
      id?: string;
      output?: { content?: { type?: string; text?: string }[] }[];
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
    };
    return {
      id: body.id,
      output_text: body.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text")?.text,
      usage: body.usage,
    };
  },
};

function omitNullObjectProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitNullObjectProperties);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== null)
      .map(([key, child]) => [key, omitNullObjectProperties(child)]),
  );
}

/** One request, no retries. The parsed value remains untrusted until independent validation. */
export class OpenAIScientificEditorialProvider implements ScientificEditorialProvider {
  constructor(
    private readonly transport: OpenAIEditorialTransport,
    private readonly config: ScientificEditorialRuntimeConfig,
    private readonly observe?: (metrics: ScientificEditorialProviderMetrics) => void,
  ) {}

  async generate(request: ScientificEditorialProviderRequest): Promise<unknown> {
    const input = JSON.stringify(request.input);
    if (input.length > this.config.maxInputCharacters)
      throw new ScientificEditorialProviderError(
        "payload_too_large",
        "Authorized editorial input exceeds the configured character limit",
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.transport.create(
        {
          model: this.config.model,
          instructions: request.systemPrompt,
          input,
          max_output_tokens: this.config.maxOutputTokens,
          text: {
            format: {
              type: "json_schema",
              name: "scientific_editorial_draft",
              strict: true,
              schema: scientificEditorialDraftJsonSchema,
            },
          },
        },
        { signal: controller.signal, apiKey: this.config.apiKey },
      );
      if (!response.output_text)
        throw new ScientificEditorialProviderError(
          "invalid_output",
          "OpenAI response contained no structured output",
        );
      let output: unknown;
      try {
        output = omitNullObjectProperties(JSON.parse(response.output_text));
      } catch {
        throw new ScientificEditorialProviderError(
          "invalid_output",
          "OpenAI structured output was not valid JSON",
        );
      }
      this.observe?.({
        model: this.config.model,
        responseId: response.id,
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens ?? 0,
              outputTokens: response.usage.output_tokens ?? 0,
              totalTokens: response.usage.total_tokens ?? 0,
            }
          : undefined,
      });
      return output;
    } catch (error) {
      if (error instanceof ScientificEditorialProviderError) throw error;
      if (controller.signal.aborted || (error as { name?: string }).name === "AbortError")
        throw new ScientificEditorialProviderError("timeout", "OpenAI request timed out");
      throw new ScientificEditorialProviderError(
        "provider_error",
        "OpenAI provider request failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
