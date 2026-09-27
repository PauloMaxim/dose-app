import type { ScientificEditorialProvider } from "./provider.server";
import type { ScientificEditorialDraft } from "./contracts";

/** Deterministic test/preview provider. It performs no I/O and no model call. */
export class DeterministicScientificEditorialProvider implements ScientificEditorialProvider {
  readonly calls: string[] = [];
  readonly requests: Parameters<ScientificEditorialProvider["generate"]>[0][] = [];

  constructor(private readonly response: ScientificEditorialDraft | unknown) {}

  async generate(request: Parameters<ScientificEditorialProvider["generate"]>[0]) {
    this.calls.push(request.promptVersion);
    this.requests.push(structuredClone(request));
    return structuredClone(this.response);
  }
}
