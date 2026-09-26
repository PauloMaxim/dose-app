# Real scientific editorial provider (prepared, not activated)

## Architectural decision

The adapter uses the OpenAI Responses API because the repository already has a server-only Responses
API seam for scientific summaries and OpenAI supports strict JSON Schema output. No SDK is added: an
injected transport keeps tests offline and the production transport is a small server-only `fetch`
adapter. The unrelated legacy xAI/Grok rewrite path remains isolated because it uses free-form chat
output, a different purpose and a client-adjacent module.

The selected default model is `gpt-5.6-sol`. It supports the Responses API and Structured Outputs and
was chosen for the first experiment to prioritize reasoning quality and scientific writing. This is a
deliberate quality-evaluation choice: cost is not yet being optimized in this phase. After the
editorial benchmark, more economical models can be compared against that quality reference. The
server-only `SCIENTIFIC_EDITORIAL_MODEL` setting can replace the model without changing provider
code.

## Configuration and failure behavior

- `OPENAI_API_KEY` is required and read only when the explicit operation runs. If absent, the
  operation fails closed with a structured `configuration` error before transport invocation.
- `SCIENTIFIC_EDITORIAL_MODEL` defaults to `gpt-5.6-sol`.
- `SCIENTIFIC_EDITORIAL_TIMEOUT_MS` defaults to 45,000 ms and aborts the single request.
- `SCIENTIFIC_EDITORIAL_MAX_INPUT_CHARS` defaults to 120,000 characters.
- `SCIENTIFIC_EDITORIAL_MAX_OUTPUT_TOKENS` defaults to 8,000 tokens.
- `SCIENTIFIC_INGESTION_TOKEN` protects the internal operational endpoint; it is not sent to OpenAI.

All settings are server-only and have no `VITE_` aliases. Invalid numeric overrides fall back to the
documented conservative bounds.

## Controlled execution and validation

`POST /api/scientific-editorial-generation` requires bearer authorization, the exact article ID
`pmid:42717033`, and `confirmRealGeneration: true`. Iptacopan and Clopidogrel/DAPT are not on this
operational allowlist. Import, build, preview rendering and GET requests cannot start generation.

One invocation makes at most one provider request and never retries. The request contains only the
existing generic prompt and the authorized source, evidence, fact, interpretation and contextual
artifacts. It does not import or serialize the approved DoseDocument or preview. OpenAI strict JSON
Schema is followed by JSON parsing and the unchanged `validateScientificEditorialDraft(...)` gate.
Rejected drafts return validation errors; accepted drafts remain pending human review.

The response is ephemeral and contains generation/article IDs, model and prompt version, start time,
duration, safe token usage when supplied, validation status/errors, and a draft only after validation.
It is not persisted, published or connected to Home, feed, catalog or the preview laboratory. Neither
scientific payloads nor credentials are logged.
