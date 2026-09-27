import "../server-only";
import { scientificEditorialDraftJsonSchema } from "./contracts";
import type { ScientificEditorialRuntimeConfig } from "./config.server";
import type {
  ScientificEditorialProvider,
  ScientificEditorialProviderRequest,
} from "./provider.server";

export interface ScientificEditorialUsage {
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
}

export interface ScientificEditorialProviderMetrics {
  responseModel?: string;
  serviceTier?: string;
  usage?: ScientificEditorialUsage;
  responseId?: string;
  status?: string;
  incompleteReason?: string;
}

export interface ScientificEditorialProviderErrorDetails {
  httpStatus?: number;
  providerCategory?: string;
  providerCode?: string;
  requestId?: string;
}

export class ScientificEditorialProviderError extends Error {
  constructor(
    public readonly code: "payload_too_large" | "timeout" | "provider_error" | "invalid_output",
    message: string,
    public readonly details?: ScientificEditorialProviderErrorDetails,
  ) {
    super(message);
  }
}

class OpenAIEditorialHttpError extends Error {
  constructor(public readonly details: ScientificEditorialProviderErrorDetails) {
    super(`OpenAI request failed with status ${details.httpStatus}`);
  }
}

export interface OpenAIEditorialTransport {
  create(
    request: Record<string, unknown>,
    options: { signal: AbortSignal; apiKey: string },
  ): Promise<{
    id?: string;
    model?: string;
    service_tier?: string;
    status?: string;
    incomplete_details?: { reason?: string } | null;
    output_text?: string;
    usage?: {
      input_tokens?: number;
      input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      output_tokens?: number;
      output_tokens_details?: { reasoning_tokens?: number };
      total_tokens?: number;
    };
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
    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = undefined;
      }
      const error =
        errorBody && typeof errorBody === "object" && "error" in errorBody
          ? (errorBody.error as unknown)
          : undefined;
      const metadata = error && typeof error === "object" ? (error as JsonErrorMetadata) : {};
      const providerCategory = sanitizedProviderMetadata(metadata.type);
      const providerCode = sanitizedProviderMetadata(metadata.code);
      const requestId = sanitizedProviderMetadata(response.headers.get("x-request-id"));
      throw new OpenAIEditorialHttpError({
        httpStatus: response.status,
        ...(providerCategory ? { providerCategory } : {}),
        ...(providerCode ? { providerCode } : {}),
        ...(requestId ? { requestId } : {}),
      });
    }
    const body = (await response.json()) as {
      id?: string;
      model?: string;
      service_tier?: string;
      status?: string;
      incomplete_details?: { reason?: string } | null;
      output?: { content?: { type?: string; text?: string }[] }[];
      usage?: {
        input_tokens?: number;
        input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
        output_tokens?: number;
        output_tokens_details?: { reasoning_tokens?: number };
        total_tokens?: number;
      };
    };
    return {
      id: body.id,
      model: body.model,
      service_tier: body.service_tier,
      status: body.status,
      incomplete_details: body.incomplete_details,
      output_text: body.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text")?.text,
      usage: body.usage,
    };
  },
};

interface JsonErrorMetadata {
  type?: unknown;
  code?: unknown;
}

function sanitizedProviderMetadata(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)
    ? value
    : undefined;
}

function sanitizedIncompleteReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  return ["max_output_tokens", "content_filter"].includes(reason) ? reason : "other";
}

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
    const input = JSON.stringify({
      scientificAuthority: {
        sourceSet: request.input.sourceSet,
        evidenceSet: request.input.evidenceSet,
        factSet: request.input.factSet,
        interpretationArtifact: request.input.interpretationArtifact,
        contextualMaterial: request.input.contextualMaterial,
        inferenceBoundaries: request.scientificAuthority.inferenceBoundaries,
      },
      editorialPolicy: request.input.editorialProfile,
    });
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
          store: false,
          reasoning: { mode: "standard", effort: "medium" },
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
      this.observe?.({
        responseModel: response.model,
        serviceTier: response.service_tier,
        responseId: response.id,
        status: response.status,
        incompleteReason: sanitizedIncompleteReason(response.incomplete_details?.reason),
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens ?? 0,
              cachedInputTokens: response.usage.input_tokens_details?.cached_tokens,
              cacheWriteTokens: response.usage.input_tokens_details?.cache_write_tokens,
              outputTokens: response.usage.output_tokens ?? 0,
              reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens,
              totalTokens: response.usage.total_tokens ?? 0,
            }
          : undefined,
      });
      if (response.status === "incomplete")
        throw new ScientificEditorialProviderError(
          "invalid_output",
          "OpenAI response was incomplete",
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
      return output;
    } catch (error) {
      if (error instanceof ScientificEditorialProviderError) throw error;
      if (controller.signal.aborted || (error as { name?: string }).name === "AbortError")
        throw new ScientificEditorialProviderError("timeout", "OpenAI request timed out");
      throw new ScientificEditorialProviderError(
        "provider_error",
        "OpenAI provider request failed",
        error instanceof OpenAIEditorialHttpError ? error.details : undefined,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
