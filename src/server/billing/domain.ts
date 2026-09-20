import { z } from "zod";

export const BILLING_FEATURES = ["premium"] as const;
export const billingFeatureSchema = z.enum(BILLING_FEATURES);
export type BillingFeature = z.infer<typeof billingFeatureSchema>;

export const subscriptionStatusSchema = z.enum([
  "pending",
  "active",
  "past_due",
  "canceled",
  "expired",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const normalizedEventSchema = z
  .object({
    provider: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    eventId: z.string().min(1).max(255),
    type: z.enum(["subscription.changed", "payment.recorded"]),
    occurredAt: z.string().datetime({ offset: true }),
    providerSubscriptionId: z.string().min(1).max(255).optional(),
    subscriptionStatus: subscriptionStatusSchema.optional(),
    periodStart: z.string().datetime({ offset: true }).nullable().optional(),
    periodEnd: z.string().datetime({ offset: true }).nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    providerPaymentId: z.string().min(1).max(255).optional(),
    paymentStatus: z
      .enum(["pending", "processing", "succeeded", "failed", "canceled", "refunded"])
      .optional(),
    amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .strict()
  .superRefine((event, context) => {
    if (
      event.type === "subscription.changed" &&
      (!event.providerSubscriptionId || !event.subscriptionStatus)
    ) {
      context.addIssue({ code: "custom", message: "Subscription event is incomplete." });
    }
    if (
      event.type === "payment.recorded" &&
      (!event.providerPaymentId ||
        !event.paymentStatus ||
        event.amountMinor === undefined ||
        !event.currency)
    ) {
      context.addIssue({ code: "custom", message: "Payment event is incomplete." });
    }
  });

export type NormalizedPaymentEvent = z.infer<typeof normalizedEventSchema>;

export function statusGrantsPremium(status: SubscriptionStatus): boolean {
  return status === "active";
}
