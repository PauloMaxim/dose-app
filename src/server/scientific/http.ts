import "./server-only";

export interface HttpOptions {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
}

export class ScientificHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function fetchScientific(url: URL, options: HttpOptions = {}): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: options.headers,
      });
      if (response.ok) return response;
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt >= retries)
        throw new ScientificHttpError(
          `Scientific source returned HTTP ${response.status}`,
          response.status,
        );
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 5_000) : 100 * 2 ** attempt,
        ),
      );
    } catch (error) {
      if (attempt >= retries || error instanceof ScientificHttpError) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
}
