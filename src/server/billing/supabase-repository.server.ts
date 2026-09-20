import "../scientific/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedPaymentEvent } from "./domain";
import type { BillingEventRepository, ReconciliationResult } from "./reconciliation.server";

export class SupabaseBillingEventRepository implements BillingEventRepository {
  constructor(private readonly admin: SupabaseClient) {}

  async reconcileVerifiedEvent(event: NormalizedPaymentEvent): Promise<ReconciliationResult> {
    const { data, error } = await this.admin.rpc("reconcile_verified_payment_event", {
      p_provider: event.provider,
      p_event_id: event.eventId,
      p_normalized_type: event.type,
      p_occurred_at: event.occurredAt,
      p_subscription_external_id: event.providerSubscriptionId ?? null,
      p_subscription_status: event.subscriptionStatus ?? null,
      p_period_start: event.periodStart ?? null,
      p_period_end: event.periodEnd ?? null,
      p_cancel_at_period_end: event.cancelAtPeriodEnd ?? false,
      p_payment_external_id: event.providerPaymentId ?? null,
      p_payment_status: event.paymentStatus ?? null,
      p_amount_minor: event.amountMinor ?? null,
      p_currency: event.currency ?? null,
    });
    if (error || !["applied", "duplicate", "stale"].includes(data as string)) {
      throw new Error("Financial reconciliation failed.");
    }
    return data as ReconciliationResult;
  }
}
