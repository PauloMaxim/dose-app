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
[model documentation](https://platform.openai.com/docs/models) were consulted again on
**2026-09-29**, but the preparation environment could not retrieve either page (HTTP tunnel 403), and
the available web lookup also returned HTTP 401. No official identifier, price, or capability could
therefore be verified from those sources. `OPENAI_API_KEY` was not present, so no credentialed account
availability check was attempted. In particular, model defaults or names already present in code are
**not** evidence that Sol or Luna is available and must not be copied into this sheet as verified
identifiers.

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

The account balance or spend capacity sufficient for the combined conservative maximum is also
**PENDING — blocked**. Model-list availability does not prove funding, quota, or permission to spend.

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

The server-only command `npm run experiment:editorial -- execute` is the restricted operator surface;
it is not an HTTP route. It prints the selected model, exact request hash and conservative maximum
cost, then requires the identified operator to type the complete attestation immediately before the
session can claim an attempt. It accepts no confirmation flag or piped confirmation argument. The
default checked-in protocol remains blocked, so merely running the command cannot make a provider
call. A future reviewed protocol file is supplied with `--protocol`, and execution additionally
requires an explicit `--model sol|luna`, `--operator <id>`, `--ledger <shared-path>`, and the
server-only `OPENAI_API_KEY` environment variable.

| Call | Human/operator ID | Confirmation ID | UTC timestamp | Exact model ID | Confirm immediately before call |
| ---- | ----------------- | --------------- | ------------- | -------------- | ------------------------------- |
| Sol  | _________________ | _______________ | _____________ | ______________ | YES / NOT AUTHORIZED            |
| Luna | _________________ | _______________ | _____________ | ______________ | YES / NOT AUTHORIZED            |

The session returns the **normalized transport response** retained by the existing adapter—not a claim
that the complete original HTTP envelope/body was preserved—plus provider usage/response metadata,
client-measured duration, deterministic-validation result, and the separate conservative cost. The
provider-reported cost remains a distinct nullable field and is never inferred from the estimate. The
operator command requires `--capture <private-path>` before confirmation or transport entry. That
existing directory must be outside the repository and every production surface; it is restricted to
mode `0700`, and each capture is atomically created without overwrite at mode `0600`. The private
record contains the normalized response and validation result required by the Phase 1.9A offline
laboratory plus experiment/case/request/model identities and metrics. It contains no API key, and the
terminal prints only operational metadata and the private path—not scientific response content. A
post-call write failure leaves the ledger claim consumed and must never trigger a retry.

### Attempt ledger and session restarts

The session-local confirmation set is not a global call counter. Creating a new process or session
would reset it, so the code does **not** claim a global limit from memory alone. Every runnable session
instead requires an injected restricted attempt ledger shared by all sessions for this experiment. Its
`claim` operation must atomically enforce uniqueness for `{experimentId, caseFingerprint, model}` and
the two-attempt experiment ceiling before the provider transport is entered. The claim is permanent
even when the call times out, fails, or returns incomplete output; `complete` records only its eventual
outcome and never releases the slot.

For the controlled run, the required `--ledger` path must be access-restricted durable storage shared
by every operator process, outside product storage and outside the repository. The supplied filesystem
ledger serializes claims with an atomic directory lock, writes the permanent claim and syncs it before
allowing transport entry, and never deletes claims after failure, timeout, or restart. An abandoned or
unreadable lock fails closed and requires human inspection; it is never automatically declared stale.
Records contain only experiment/case/model/request/confirmation identities, timestamps and outcome,
never credentials or private response content. A local temporary path, an in-memory implementation,
or a path not shared by every possible runner does not satisfy the protocol and does not authorize
execution.

### Restricted operational commands

1. `npm run experiment:editorial -- preflight --protocol <reviewed-protocol.json>` prints the frozen
   case, both model IDs, request hashes, per-call maxima, combined maximum, and every blocker. The
   combined conservative maximum must be at most US$ 1.00. A blocked result exits nonzero after
   printing every blocker, so it cannot be treated as a successful automation gate.
2. After exact IDs are established from official documentation, an authorized operator may run
   `npm run experiment:editorial -- availability --protocol <reviewed-protocol.json>`. This performs
   only `GET /v1/models`, reports whether each exact ID was returned for the account, and never prints
   the credential. It does not establish balance or quota; those remain blocking unless independently
   confirmed through an authorized account surface and recorded in the protocol's `accountFunding`
   evidence with an official HTTPS source and UTC timestamp.
3. Only after the protocol, shared ledger location and preflight have been reviewed, run one model at
   a time with `npm run experiment:editorial --` followed by the `execute` command, reviewed protocol,
   one model, identified operator, shared ledger and private capture paths. The two paid calls were
   **not** executed while preparing this tooling.

```text
execute --protocol <reviewed-protocol.json> --model sol|luna --operator <id> --ledger <shared-path> --capture <private-path>
```

### Offline capture adapter

`adaptRestrictedCaptureToRecordedEditorialResponse()` performs the deterministic, I/O-free projection
into the Phase 1.9A laboratory contract. Experiment ID, case ID/fingerprint and model ID map directly.
The adapter parses the unchanged normalized `output_text` JSON as the laboratory response, maps only
complete provider-reported input/output token counts, records the already client-measured duration as
latency, and leaves cost `null`: the captured conservative maximum is a ceiling, not observed spend.
The fixed 1.9B request conditions supply the explicit OpenAI provider, 8,000-token output limit, strict
v5 format, no additional instructions, and `standard`/`medium` reasoning configuration.

The laboratory does not accept operational fields such as request hash, confirmation ID, label,
timestamps, maximum-cost ceiling, normalized envelope, or the first-pass validation result; those
remain in the private capture for audit and are not smuggled into its strict input contract. The
laboratory independently repeats deterministic validation over the parsed original response. Failed,
incomplete, wrong-case, or non-JSON captures are rejected. Provenance is a required adapter argument,
so offline tests must explicitly use `synthetic_test_fixture`; only an actual captured provider call
may be identified as `recorded_model_output`.
