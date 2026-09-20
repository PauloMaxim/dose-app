# Billing and entitlement architecture

## Audit baseline

The foundation migration already separated `plans`, `subscriptions`, `payments`,
`payment_events`, and `entitlements`. It provided ownership foreign keys,
provider/external-ID uniqueness, `(provider,event_id)` event deduplication, RLS,
own-row reads, staff inspection, and explicit revocation of authenticated writes.
Those controls are retained. `profiles` has no billing plan column.

The remaining implementation was a prototype: browser `profile.plan` powered UI
gates, the payment screen could select a local plan in demo mode, there was no
provider contract or verified webhook pipeline, event timestamps did not guard
against reordering, event payload retention was unconstrained, and no atomic
reconciliation connected subscription state to canonical authorization.

## Trust and domain boundaries

The production flow is:

1. a server-only provider adapter receives exact raw bytes;
2. the adapter checks size and signature before JSON parsing;
3. it validates and normalizes the event into Dose vocabulary;
4. a server repository invokes one service-role-only database function;
5. the transaction claims `(provider,event_id)`, resolves an existing
   server-created subscription by provider/external ID, updates financial state,
   and derives the `premium` entitlement;
6. server authorization reads active, started, unexpired entitlements and fails
   closed on query errors.

No normalized event accepts a `user_id`. A provider identifier is not accepted
from an application client; webhook reconciliation can only use a subscription
mapping that trusted server code created earlier. Checkout redirects, plans,
payments, query parameters, Zustand, and local storage are never authorization.

`plans` describe commercial offers. `subscriptions` represent recurring
provider state. `payments` are immutable-minded audit records and do not grant
features. `entitlements` are provider-agnostic authorization records. The first
internal feature is `premium`; provider products are translated at the boundary.

## Replay, ordering, and atomicity

The unique event key is claimed inside the transaction, so concurrent retries
cannot duplicate effects. Each subscription stores its last provider occurrence
timestamp and event ID. An older `(timestamp,event_id)` tuple is recorded as
`stale` but cannot overwrite newer state. Equal timestamps have a deterministic
event-ID tie-break. Unknown mappings are conservatively rejected. Real adapters
should retrieve provider state when their semantics cannot be safely ordered
from event data alone.

Subscription status is normalized to `pending`, `active`, `past_due`,
`canceled`, or `expired`; only `active` grants `premium`. Cancellation,
expiration, delinquency, and pending state make it inactive (expiration is
preserved distinctly). A successful payment only updates the payment ledger.

The database function performs event claim, locked subscription update, payment
write, entitlement upsert, and outcome update atomically. Execution is revoked
from `public`, `anon`, and `authenticated` and granted only to `service_role`.
Existing RLS remains enabled and authenticated users retain read-only access to
their own billing projections.

## Data minimization and activation checklist

Only sanitized normalized metadata is persisted; raw payloads, card data,
authorization headers, API keys, and webhook secrets must never be stored. The
fake provider is deterministic, HMAC-authenticated, offline-only, and cannot
charge. No Stripe/Asaas SDK is installed and no real adapter is enabled.

Before real activation: implement and security-review a provider adapter;
server-create pending customer/subscription mappings; configure secrets only in
the server runtime; add timestamped replay tolerance appropriate to that
provider; decide retry/dead-letter operations; add provider reconciliation jobs;
apply the migration through the reviewed deployment process; and exercise the
flow in provider sandbox mode. Apple and Google adapters can later emit the same
normalized events without changing entitlement authorization.
