import type { GenerateEditorialDraftInput } from "./generator";
import type { ScientificEditorialDraft } from "./contracts";

export interface ScientificEditorialProviderRequest {
  promptVersion: string;
  systemPrompt: string;
  input: GenerateEditorialDraftInput;
}

/** Server-only provider seam. Implementations must not log payloads or expose credentials. */
export interface ScientificEditorialProvider {
  generate(request: ScientificEditorialProviderRequest): Promise<unknown>;
}

export type ScientificEditorialProviderOutput = ScientificEditorialDraft | unknown;
