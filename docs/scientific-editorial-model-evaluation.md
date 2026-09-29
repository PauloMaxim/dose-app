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

## Phase 1.9B execution sheet — prepared, blocked, and not executed

Preparation date: **2026-09-29**. No API call was made while preparing this sheet. The checked-in
protocol is `editorial-experiment:pmid:42717033:phase-1.9b:v1`, exclusively for PMID 42717033, with
the case identity produced by `createPmid42717033EvaluationCase()`. Immediately before a future run,
copy the preflight's exact `caseId`, `caseFingerprint`, prompt version, profile, artifact IDs/versions,
source scopes, and context allowlists here; never transcribe or reconstruct them by hand.

### Verification status and blocking pendencies

The official OpenAI [API pricing page](https://openai.com/api/pricing/) and
[model documentation](https://platform.openai.com/docs/models) were consulted on **2026-09-29**, but
the preparation environment could not retrieve either page (HTTP tunnel 403). No official identifier
or price could therefore be verified from those sources. Account-specific availability was also not
verified because this preparation is expressly offline and must not use a credential or contact an
API. In particular, the legacy code default `gpt-6-sol` is **not** evidence that Sol is available and
must not be copied into this sheet as a verified identifier.

Consequently, both checked-in model identifiers, price records, and account-availability timestamps
are `null`; the real preflight fails closed. A future operator must fill them from current official
OpenAI documentation and a separately authorized, credentialed account-availability check, retaining
the official URL and UTC consultation timestamp. Until that happens, **execution is blocked**.

| Field                                    | Sol               | Luna              |
| ---------------------------------------- | ----------------- | ----------------- |
| Exact provider/model ID                  | PENDING — blocked | PENDING — blocked |
| Available to experiment acct.            | PENDING — blocked | PENDING — blocked |
| Input USD / 1M tokens                    | PENDING — blocked | PENDING — blocked |
| Output USD / 1M tokens                   | PENDING — blocked | PENDING — blocked |
| Reasoning USD / 1M tokens                | PENDING — blocked | PENDING — blocked |
| Official source URL                      | PENDING — blocked | PENDING — blocked |
| Strict-schema/reasoning compatibility    | PENDING — blocked | PENDING — blocked |
| Price/availability/capability checked at | PENDING — blocked | PENDING — blocked |

### Fixed shared conditions

- joint budget ceiling: **US$ 1.00**, not a spend target;
- maximum calls: **two total and one per model**; retries: **zero**;
- timeout per attempted call: **90,000 ms**; timeout, incomplete output, and provider error still
  consume that model's sole attempt because they may be billable;
- maximum Responses output allowance: **8,000 tokens**, shared by visible output and reasoning—not
  the production adapter's 25,000-token default;
- response format: `scientific_editorial_draft.v5` strict JSON Schema; `store: false`;
- reasoning mode/effort: `standard` / `medium` for both models;
- no additional instructions and no variation in the frozen scientific input, authorized context,
  editorial profile, prompt, case ID, or case fingerprint.

The offline preflight materializes and deeply freezes the complete provider request for each configured model. Its input
ceiling is the UTF-8 byte length of the entire serialized request (including instructions and schema),
a deliberately conservative token upper bound. Its output ceiling is 8,000 tokens, all charged at the
higher verified output-or-reasoning rate; input is charged at the verified non-cached input rate. The
two maxima are summed and execution is rejected unless the sum is at most US$ 1.00. Cached-input
discounts are deliberately ignored. An unknown price makes the calculation unknown and fails the
preflight rather than being treated as zero.

Each request receives a SHA-256 identity over canonical JSON. The operator confirmation must repeat
that identity and the exact maximum estimated cost. Immediately before transport invocation, the
session independently rebuilds the request through the existing generator/adapter path, compares both
its canonical content and hash to the approved frozen request, and sends a clone of the approved
request only. A mismatch in model, prompt, inputs, format, reasoning or limits fails before the
underlying transport. Preflight also rejects equal Sol/Luna IDs, invalid or future verification dates,
and models whose current official compatibility with strict JSON Schema plus `standard`/`medium`
reasoning has not been recorded.

### Pre-execution record (must be completed without committing private output)

| Item                                       | Value                                              |
| ------------------------------------------ | -------------------------------------------------- |
| HEAD / reviewed commit                     | ______________________________________             |
| Experiment ID                              | `editorial-experiment:pmid:42717033:phase-1.9b:v1` |
| Case ID                                    | ______________________________________             |
| Case fingerprint                           | ______________________________________             |
| Prompt version                             | ______________________________________             |
| Sol maximum input/output/reasoning tokens  | ______________________________________             |
| Luna maximum input/output/reasoning tokens | ______________________________________             |
| Sol conservative maximum cost              | US$ __________________________________             |
| Luna conservative maximum cost             | US$ __________________________________             |
| Combined conservative maximum cost         | US$ __________________________________             |
| Preflight result                           | PASS / BLOCKED                                     |

### Two independent human confirmations

Confirmation is short-lived, bound to the exact experiment, model, case ID, fingerprint, request hash
and maximum cost, and single-use. It is consumed before transport invocation. A Sol confirmation
cannot authorize Luna. The session deliberately exposes no confirmation factory: an operator-controlled
surface outside the execution session must collect an identified human's explicit attestation and
construct the record immediately before that individual call. Merely instantiating the session or
calling `run()` is not authorization.

No operator-controlled authorization surface has been provisioned in this phase. The confirmation
type is only a validation contract and cannot, by itself, prove that a human performed the required
action. Execution remains blocked until that restricted surface exists and its behavior is reviewed.

| Call | Human/operator ID | Confirmation ID | UTC timestamp | Exact model ID | Confirm immediately before call |
| ---- | ----------------- | --------------- | ------------- | -------------- | ------------------------------- |
| Sol  | _________________ | _______________ | _____________ | ______________ | YES / NOT AUTHORIZED            |
| Luna | _________________ | _______________ | _____________ | ______________ | YES / NOT AUTHORIZED            |

The session returns the **normalized transport response** retained by the existing adapter—not a claim
that the complete original HTTP envelope/body was preserved—plus provider usage/response metadata,
client-measured duration, deterministic-validation result, and the separate conservative cost. The
provider-reported cost remains a distinct nullable field and is never inferred from the estimate.
Capture is in memory only: there is no endpoint, filesystem writer, Supabase persistence, feed,
preview, publication, or automatic export. The operator must place any approved private records only
in the restricted experiment storage defined outside this repository and then use the Phase 1.9A
offline laboratory for comparison and blinded review.

### Attempt ledger and session restarts

The session-local confirmation set is not a global call counter. Creating a new process or session
would reset it, so the code does **not** claim a global limit from memory alone. Every runnable session
instead requires an injected restricted attempt ledger shared by all sessions for this experiment. Its
`claim` operation must atomically enforce uniqueness for `{experimentId, caseFingerprint, model}` and
the two-attempt experiment ceiling before the provider transport is entered. The claim is permanent
even when the call times out, fails, or returns incomplete output; `complete` records only its eventual
outcome and never releases the slot.

For the controlled run, provision an access-restricted, append-only experiment record outside product
storage, reviewed by the operator before either call. It must not be a public endpoint, production
Supabase table, feed integration, or repository file. Both sessions must use the same ledger instance
or backend. Record only experiment/case/model/request/confirmation identities, timestamps and outcome;
never credentials or private response content. If an atomic shared ledger is unavailable, execution
remains blocked. The repository supplies only the ledger contract because selecting or provisioning a
real operational store was not authorized in Phase 1.9B.

Likewise, `RestrictedExperimentAttemptLedger` is only a contract: no real shared ledger backend has
been provisioned. Supplying an ad hoc in-memory implementation does not establish a cross-process
limit and does not authorize execution.
