# Scientific summaries — production pipeline (Prompt 9)

## Audit and preserved foundations

The existing implementation already had the right boundaries: a provider-independent interface, an injected (therefore offline-testable) OpenAI Responses transport, a deterministic fake, a fail-closed server configuration, a strict v1 schema, canonical input hashing, bounded retries, a unique `identity_key`, completed-only authenticated reads, and no authenticated writes. The feed did not trigger generation and already distinguished feed from summary eligibility.

The production gaps were a client-provided `summaryEligible` hint being trusted by the pipeline, different feed/pipeline abstract thresholds, an incomplete pedagogical contract, no identifier/full-text fidelity checks, no OpenAI timeout or permanent-provider classification, no duration/failure taxonomy, and no implemented database lease ownership primitive. The v1 contract also could not explicitly enumerate which unsupported fields were absent.

## Versioned v2 contract

`scientific-summary.v2` is intentionally incompatible with v1 and receives a new identity/cache entry. It is strict (`additionalProperties: false`) and includes:

- contextual title, scientific question, context, study design, population/sample;
- intervention/exposure, comparator, primary outcomes and main results;
- interpretation, limitations, practical implications and evidence type;
- one to eight key points;
- canonical DOI/PMID/PMCID (including explicit `null`);
- `unavailableFields`, which must exactly match nullable unsupported fields;
- explicit schema version and the fixed `abstract_and_metadata` source scope.

Strings and arrays are bounded. Both Zod runtime validation and a provider-neutral JSON Schema are maintained. The latter is suitable for strict Structured Outputs.

## Trusted flow and fidelity

The controlled server flow is:

1. load the canonical persisted article;
2. recompute eligibility (non-empty abstract, at least 120 characters, configured input maximum);
3. construct an allowlisted canonical input containing metadata and abstract only;
4. hash input and configuration identity;
5. atomically claim a bounded lease;
6. call the selected injected provider with a timeout;
7. validate the strict schema;
8. deterministically compare all identifiers, numeric claims, unknown DOI references and prohibited full-text claims;
9. save only claim-owned output as `completed`.

These checks are deliberately verifiable rather than a claim of semantic fact checking. Generated prose is not a scientific source; the original abstract and metadata remain authoritative. Missing evidence is represented by `null` plus `unavailableFields`, never filled by inference.

## Idempotency, failures, cost, and operation

The logical key hashes article id, canonical input hash, prompt/schema versions, provider and model. The additive Prompt 9 migration adds an atomic service-role-only claim function, per-attempt claim token, bounded lease, stable failure code and duration. A stale worker cannot save after losing its claim. Retry is limited to timeout, rate limit and transient failures and capped by configuration; permanent HTTP failures, invalid schema and fidelity failures are not retried.

Usage stores input/output/total/cached tokens. A cost estimator is injected with provider/model context; pricing is not hardcoded and its externally managed version can use the existing `cost_config_version`. Provider metadata is restricted to a small adapter-produced record, errors are sanitized and provider bodies, API keys, authorization headers and abstracts are not logged.

The OpenAI adapter prepares the Responses API with strict JSON Schema, injected transport, abort timeout and usage extraction. Importing it performs no request. `AI_SUMMARY_ENABLED` defaults to false; provider/model/limits/timeout are server-only variables. No `VITE_*` API key exists.

## Security, RLS, and feed

Only trusted service-role code may claim or mutate summaries. The historical RLS policy remains unchanged: authenticated users can select completed summaries, while anonymous access and authenticated insert/update/delete remain revoked. The new claim function is revoked from public, anonymous and authenticated roles and granted only to `service_role`.

Clients cannot provide source text, prompt, output, provider, model, user id, usage or cost. No public generation endpoint was added; activation belongs in an explicitly authenticated/authorized, rate-limited server operation or worker. Feed reads only report the centralized eligibility decision and never cause generation, so no paid call or N+1 summary query is introduced.

## Migration and activation

`202609290001_harden_scientific_summary_pipeline.sql` is additive and forward-only. It is required because the historical table had a unique identity and `claimed_at`, but lacked lease expiry and an ownership token; without those fields a crashed worker could block forever or a stale worker could overwrite a later attempt. Do not edit or reapply the historical migration. This repository task only prepares the file; it does not execute it.

Before future activation, apply the migration through the normal reviewed deployment process, construct `SupabaseSummaryRepository` with a server-only service-role client, inject an approved transport and externally maintained pricing estimator, configure operational rate limiting/queueing, then explicitly set `AI_SUMMARY_ENABLED=true`. Tests use only the fake/injected transports and never contact OpenAI.
