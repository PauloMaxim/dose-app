# Scientific summaries (Phase 3C)

The server reconstructs trusted scientific input from an article, enforces `summaryEligible` and a minimum abstract, hashes canonical input, and combines that hash with article, prompt/schema versions, provider, and model. A unique database identity and atomic claim ensure concurrent consumers share one generation. Completed summaries are article assets, not user-owned records.

## Scope and contract

Only title, abstract, bibliographic identifiers and scientific metadata are supplied. No PDF, full text, notes, profile, email, progress, collection, secret, or user identifier is included. The versioned strict contract contains a concise summary, nullable objective/design/sample/methods/findings/conclusion/limitations/implications/evidence/cautions, structured numbers and terms, and the literal `abstract_and_metadata` source scope. Output is server-validated, including a conservative check that structured numeric claims occur in the source.

The prompt prohibits invented facts, numbers, methods, sample sizes, limitations and clinical implications; causal upgrades and extrapolation; and asks for null when unavailable. Generated text never changes article metadata and is not a substitute for the original article.

## Providers, operation, and cost

`ScientificSummaryProvider` isolates the domain. The OpenAI adapter prepares the Responses API `json_schema` Structured Output request using an injected transport; the fake adapter supports deterministic offline tests. `AI_SUMMARY_ENABLED` is fail-closed, while provider/model and input/output/attempt limits are server environment settings. `OPENAI_API_KEY` is only needed by future composition code when real OpenAI generation is explicitly enabled—it is not read by the domain or exposed with a `VITE_` prefix.

Failures distinguish timeout, rate limit, transient transport, invalid output, and configuration. Retryable failures are bounded by `AI_SUMMARY_MAX_ATTEMPTS`; sanitized errors only are stored. Usage supports input/output/total/cached tokens. Cost is an injected estimator whose pricing/version can be managed outside the domain; no price is hardcoded.

To activate OpenAI later, provide a server-only Responses transport and key, select `AI_SUMMARY_PROVIDER=openai`, choose `AI_SUMMARY_MODEL`, and only then set `AI_SUMMARY_ENABLED=true`. **Nenhuma chamada real à OpenAI é feita enquanto a geração real estiver desabilitada/não configurada.**

Clients may request a permitted article id, but may not submit source content, prompts, provider/model selection, or output. Service-role/server code alone claims and writes summary rows. Authenticated clients can read completed summaries only for eligible articles under RLS; no client write grants exist.
