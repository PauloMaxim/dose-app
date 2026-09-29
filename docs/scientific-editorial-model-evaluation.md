# Offline editorial model evaluation — Phase 1.9A

This laboratory compares previously recorded Sol and Luna responses against exactly the same reviewed
PMID 42717033 inputs. It does not call a model, persist a result, publish editorial content, or select
a winner. The existing `ScientificEditorialProvider` seam, validated generator and deterministic
validator remain the only editorial pipeline.

## Frozen case

`createPmid42717033EvaluationCase()` records the case/protocol identity, prompt and editorial-profile
versions, IDs and schema versions of SOURCE → EVIDENCE → FACTS → INTERPRETATION and contextual
artifacts, abstract-only source scope, authorized external-reference IDs and contextual-claim IDs. Its
`caseFingerprint` is a SHA-256 digest of canonical JSON containing the complete scientific inputs,
context and allowlist, editorial profile and prompt version—not merely their IDs. A content change
therefore creates a different fingerprint even if an ID was incorrectly reused.
Only this canary is admitted. Add another case only after its inputs and reference criteria have been
reviewed and authorized; do not silently generalize this case factory.

## Running the offline comparison

1. Store each response outside production paths and label its provenance as `recorded_model_output`.
   Tests must instead use `synthetic_test_fixture`; the existing experimental fixture is not a real
   model result.
2. In each record declare the exact `experimentId`, `caseId` and `caseFingerprint` captured before the
   run. The laboratory rejects a record that does not match the frozen case rather than attaching it
   to the canary implicitly.
3. Pass two records to `compareRecordedEditorialResponses()`. Each record must have a distinct model
   identifier, the complete explicit generation configuration, the unmodified response, and only
   observed token/cost/latency metrics. The `shared` configuration contains the comparable output-token
   limit, strict response format and absence of extra instructions; these fields must be identical.
   Provider/model identifiers and parameters in `modelSpecific` may differ and are listed in
   `configurationDifferences` for the reviewer.
4. Use `metrics: null` when metrics are unavailable. When present, metrics are an all-fields record:
   token counts identify provider reporting, latency identifies provider or client measurement, and
   cost distinguishes `estimated` (with a non-empty pricing basis) from `provider_reported`. All
   numeric observations must be finite and non-negative; token counts must also be integers.
5. Run `npx tsx --test src/server/scientific/editorial-draft/evaluation-lab.test.ts`.
6. Export or copy the returned in-memory report only to the approved experiment record. This module
   contains no filesystem, Supabase, publication, feed, preview or production-provider integration.

The automatic section reports schema and deterministic grounding-contract validity and validator
errors. `scientificApproval` is always `false`: structural acceptance is not scientific approval.

## Human review

An unperformed review is exactly `null`. A performed review is accepted only as one complete record
with a non-empty reviewer ID, ISO timestamp, finite non-negative measured duration, all criteria and
correction requirement. For each model independently, a qualified reviewer must use an integer rating
from 1 (worst) to 5 (best) and non-empty notes for:

- fidelity to facts, numbers, units, confidence intervals and time horizons;
- preservation of limitations and scientific uncertainty;
- ungrounded claims and improper extrapolations;
- correct use of authorized external context;
- scientifically relevant omissions;
- editorial clarity, depth and organization;

Record correction need separately as `none`, `minor`, `major` or `rewrite`, with non-empty notes.

Partial reviews are rejected rather than represented as complete. Never infer review fields from
deterministic validation. Use the same reviewer instructions and display order for both blinded
responses, and retain notes so ratings remain auditable.

## Protocol for a future real experiment

Before every experiment, require a human operator to approve a written run sheet containing:

1. experiment ID, the frozen case ID and fingerprint, and verification that all input IDs/versions and
   authorized context limits match the snapshot;
2. explicit Sol and Luna provider/model identifiers and every generation parameter;
3. an experiment-wide maximum dollar budget and a maximum of **two provider calls** (one per model),
   with retries disabled;
4. provider price source/date and a preflight worst-case cost calculation below the approved budget;
5. explicit confirmation immediately before each individual paid call, plus a stop if confirmation,
   remaining call allowance or remaining budget is absent;
6. capture of raw responses and provider-reported token usage/latency without publishing or sending
   either response into product surfaces;
7. offline deterministic evaluation followed by separate blinded human review using the rubric above.

Phase 1.9A authorizes none of those calls. The operator must not use the existing real-generation
endpoint as an implicit batch runner, must not retry, and must stop after recording the two responses.
