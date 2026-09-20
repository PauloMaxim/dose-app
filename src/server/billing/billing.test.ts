import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { NormalizedPaymentEvent, SubscriptionStatus } from "./domain";
import { statusGrantsPremium } from "./domain";
import { FakePaymentProvider } from "./fake-provider.server";
import {
  handlePaymentWebhook,
  type BillingEventRepository,
  type ReconciliationResult,
} from "./reconciliation.server";

const SECRET = "offline-test-secret-only";
const occurredAt = "2026-09-20T12:00:00.000Z";

class MemoryRepository implements BillingEventRepository {
  readonly events = new Set<string>();
  status: SubscriptionStatus = "pending";
  premium = false;
  last = "";
  payments = 0;

  async reconcileVerifiedEvent(event: NormalizedPaymentEvent): Promise<ReconciliationResult> {
    const key = `${event.provider}:${event.eventId}`;
    if (this.events.has(key)) return "duplicate";
    this.events.add(key);
    if (event.occurredAt < this.last) return "stale";
    this.last = event.occurredAt;
    if (event.type === "subscription.changed") {
      this.status = event.subscriptionStatus!;
      this.premium = statusGrantsPremium(this.status);
    } else {
      this.payments += 1;
    }
    return "applied";
  }
}

function subscriptionEvent(
  overrides: Partial<NormalizedPaymentEvent> = {},
): NormalizedPaymentEvent {
  return {
    provider: "fake",
    eventId: "evt_1",
    type: "subscription.changed",
    occurredAt,
    providerSubscriptionId: "sub_server_mapped",
    subscriptionStatus: "active",
    periodStart: occurredAt,
    periodEnd: "2026-10-20T12:00:00.000Z",
    ...overrides,
  };
}

async function deliver(event: NormalizedPaymentEvent, repository: MemoryRepository) {
  const provider = new FakePaymentProvider(SECRET);
  const raw = Buffer.from(JSON.stringify(event));
  return handlePaymentWebhook(provider, repository, raw, provider.sign(raw));
}

test("free, expired, canceled and past-due states do not grant premium", () => {
  assert.equal(statusGrantsPremium("pending"), false);
  assert.equal(statusGrantsPremium("expired"), false);
  assert.equal(statusGrantsPremium("canceled"), false);
  assert.equal(statusGrantsPremium("past_due"), false);
  assert.equal(statusGrantsPremium("active"), true);
});

test("fake provider verifies first, normalizes offline and rejects invalid signatures", async () => {
  const provider = new FakePaymentProvider(SECRET);
  const raw = Buffer.from(JSON.stringify(subscriptionEvent()));
  await assert.rejects(() => handlePaymentWebhook(provider, new MemoryRepository(), raw, "00"));
  assert.deepEqual(
    await provider.verifyAndNormalizeWebhook(raw, provider.sign(raw)),
    subscriptionEvent(),
  );
});

test("unexpected, oversized, missing-id and unknown-provider payloads are rejected", async () => {
  const provider = new FakePaymentProvider(SECRET);
  for (const value of [
    { arbitrary: true },
    { ...subscriptionEvent(), eventId: "" },
    { ...subscriptionEvent(), provider: "stripe" },
  ]) {
    const raw = Buffer.from(JSON.stringify(value));
    await assert.rejects(() => provider.verifyAndNormalizeWebhook(raw, provider.sign(raw)));
  }
  const huge = Buffer.alloc(256 * 1024 + 1);
  await assert.rejects(() => provider.verifyAndNormalizeWebhook(huge, provider.sign(huge)));
});

test("duplicate and concurrent replay create one effect", async () => {
  const repository = new MemoryRepository();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => deliver(subscriptionEvent(), repository)),
  );
  assert.equal(results.filter((result) => result === "applied").length, 1);
  assert.equal(repository.events.size, 1);
  assert.equal(repository.premium, true);
});

test("out-of-order downgrade is stale and cannot corrupt active state", async () => {
  const repository = new MemoryRepository();
  await deliver(
    subscriptionEvent({ eventId: "new", occurredAt: "2026-09-20T13:00:00.000Z" }),
    repository,
  );
  assert.equal(
    await deliver(
      subscriptionEvent({
        eventId: "old",
        occurredAt: "2026-09-20T11:00:00.000Z",
        subscriptionStatus: "expired",
      }),
      repository,
    ),
    "stale",
  );
  assert.equal(repository.premium, true);
});

test("active grants; later cancellation removes access", async () => {
  const repository = new MemoryRepository();
  await deliver(subscriptionEvent(), repository);
  assert.equal(repository.premium, true);
  await deliver(
    subscriptionEvent({
      eventId: "evt_2",
      occurredAt: "2026-09-21T12:00:00.000Z",
      subscriptionStatus: "canceled",
    }),
    repository,
  );
  assert.equal(repository.premium, false);
});

test("an isolated successful payment remains audit-only", async () => {
  const repository = new MemoryRepository();
  await deliver(
    {
      provider: "fake",
      eventId: "pay_1",
      type: "payment.recorded",
      occurredAt,
      providerSubscriptionId: "sub_server_mapped",
      providerPaymentId: "payment_1",
      paymentStatus: "succeeded",
      amountMinor: 100,
      currency: "BRL",
    },
    repository,
  );
  assert.equal(repository.payments, 1);
  assert.equal(repository.premium, false);
});

test("migration enforces database idempotency, server mapping, atomic entitlement and grants", async () => {
  const sql = await readFile(
    new URL(
      "../../../supabase/migrations/202609300001_secure_billing_entitlements.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /on conflict \(provider, event_id\) do nothing/);
  assert.match(
    sql,
    /where provider = p_provider and external_id = p_subscription_external_id[\s\S]*for update/,
  );
  assert.doesNotMatch(sql, /p_user_id/);
  assert.match(sql, /insert into public\.entitlements/);
  assert.match(sql, /Payment audit state deliberately never mutates entitlement/);
  assert.match(sql, /revoke all on function public\.reconcile_verified_payment_event/);
  assert.match(sql, /to service_role/);
});

test("no client secret or real financial adapter is present", async () => {
  const env = await readFile(new URL("../../../.env.example", import.meta.url), "utf8");
  assert.doesNotMatch(env, /VITE_(STRIPE|PAYMENT|ASAAS|WEBHOOK)/);
  assert.match(env, /PAYMENT_WEBHOOK_SECRET=/);
  assert.doesNotMatch(env, /PAYMENT_WEBHOOK_SECRET=.+/);
});

test("client plan and payment prototype cannot promote authorization", async () => {
  const store = await readFile(new URL("../../lib/store.ts", import.meta.url), "utf8");
  const payment = await readFile(new URL("../../routes/pagamento.tsx", import.meta.url), "utf8");
  assert.match(store, /\.\.\.partial, plan: s\.profile\.plan/);
  assert.match(store, /Billing state is never restored from browser storage/);
  assert.doesNotMatch(payment, /cc-number|cc-csc|Já paguei|plan: id/);
  assert.match(payment, /Continuar no Free/);
});
