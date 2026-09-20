import assert from "node:assert/strict";
import { test } from "node:test";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "./contracts";

test("push subscription accepts a strict HTTPS Web Push shape", () => {
  assert.equal(
    pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example/sub",
      p256dh: "a".repeat(16),
      auth: "b".repeat(8),
    }).success,
    true,
  );
  assert.equal(
    pushSubscriptionSchema.safeParse({
      endpoint: "http://push.example/sub",
      p256dh: "a".repeat(16),
      auth: "b".repeat(8),
      user_id: "attacker",
    }).success,
    false,
  );
});

test("unsubscribe only accepts an HTTPS endpoint", () => {
  assert.equal(
    pushUnsubscribeSchema.safeParse({ endpoint: "https://push.example/sub" }).success,
    true,
  );
  assert.equal(pushUnsubscribeSchema.safeParse({ endpoint: "javascript:alert(1)" }).success, false);
});
