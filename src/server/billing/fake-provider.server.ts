import "../scientific/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizedEventSchema, type NormalizedPaymentEvent } from "./domain";
import {
  MAX_WEBHOOK_BYTES,
  WebhookRejectedError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentProvider,
} from "./provider.server";

/** Offline-only adapter. It deliberately cannot charge or contact a network. */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  constructor(private readonly webhookSecret: string) {
    if (webhookSecret.length < 16) throw new Error("Fake webhook secret is too short.");
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    return {
      providerSessionId: `fake_${request.userId}`,
      redirectUrl: "https://example.invalid/fake-checkout",
    };
  }
  async retrieveSubscription(providerSubscriptionId: string): Promise<unknown> {
    return { id: providerSubscriptionId, offline: true };
  }
  async cancelSubscription(): Promise<void> {}

  sign(rawBody: Uint8Array): string {
    return createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
  }

  async verifyAndNormalizeWebhook(
    rawBody: Uint8Array,
    signature: string | null,
  ): Promise<NormalizedPaymentEvent> {
    if (rawBody.byteLength === 0 || rawBody.byteLength > MAX_WEBHOOK_BYTES || !signature) {
      throw new WebhookRejectedError();
    }
    const expected = Buffer.from(this.sign(rawBody), "hex");
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, "hex");
    } catch {
      throw new WebhookRejectedError();
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new WebhookRejectedError();
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(Buffer.from(rawBody).toString("utf8"));
    } catch {
      throw new WebhookRejectedError("Malformed webhook payload.");
    }
    const parsed = normalizedEventSchema.safeParse(candidate);
    if (!parsed.success || parsed.data.provider !== this.name) {
      throw new WebhookRejectedError("Unexpected webhook payload.");
    }
    return parsed.data;
  }
}
