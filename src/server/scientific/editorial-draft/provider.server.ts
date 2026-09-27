import type { GenerateEditorialDraftInput } from "./generator";
import type { ScientificEditorialDraft } from "./contracts";
import type { EditorialScientificAuthority } from "./scientific-authority";

export interface ScientificEditorialProviderRequest {
  promptVersion: string;
  systemPrompt: string;
  input: GenerateEditorialDraftInput;
  scientificAuthority: EditorialScientificAuthority;
}

/** Server-only provider seam. Implementations must not log payloads or expose credentials. */
export interface ScientificEditorialProvider {
  generate(request: ScientificEditorialProviderRequest): Promise<unknown>;
}

export type ScientificEditorialProviderOutput = ScientificEditorialDraft | unknown;
