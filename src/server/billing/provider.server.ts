import "../scientific/server-only";
import type { NormalizedPaymentEvent } from "./domain";

export const MAX_WEBHOOK_BYTES = 256 * 1024;

export interface CheckoutRequest {
  readonly userId: string;
  readonly planCode: string;
  readonly returnUrl: string;
}

export interface CheckoutSession {
  readonly providerSessionId: string;
  readonly redirectUrl: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  retrieveSubscription(providerSubscriptionId: string): Promise<unknown>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  /** Must authenticate raw bytes before parsing or returning any event. */
  verifyAndNormalizeWebhook(
    rawBody: Uint8Array,
    signature: string | null,
  ): Promise<NormalizedPaymentEvent>;
}

export class WebhookRejectedError extends Error {
  constructor(message = "Webhook rejected.") {
    super(message);
    this.name = "WebhookRejectedError";
  }
}
