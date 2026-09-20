import "../scientific/server-only";
import type { NormalizedPaymentEvent } from "./domain";
import type { PaymentProvider } from "./provider.server";

export type ReconciliationResult = "applied" | "duplicate" | "stale";

export interface BillingEventRepository {
  /** Atomically claims the event and reconciles subscription/payment + entitlement. */
  reconcileVerifiedEvent(event: NormalizedPaymentEvent): Promise<ReconciliationResult>;
}

export async function handlePaymentWebhook(
  provider: PaymentProvider,
  repository: BillingEventRepository,
  rawBody: Uint8Array,
  signature: string | null,
): Promise<ReconciliationResult> {
  // No JSON access occurs before the adapter authenticates the exact raw bytes.
  const verified = await provider.verifyAndNormalizeWebhook(rawBody, signature);
  return repository.reconcileVerifiedEvent(verified);
}
