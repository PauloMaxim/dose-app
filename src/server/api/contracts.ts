import { z } from "zod";

export const entityIdSchema = z.string().uuid();
export const articleKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).nullable().optional(),
    avatarPath: z.string().trim().min(1).max(500).nullable().optional(),
    locale: z
      .string()
      .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
      .optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    onboardingCompleted: z.boolean().optional(),
  })
  .strict();

export const interestTargetSchema = z.union([
  z.object({ specialtyId: entityIdSchema, topicId: z.never().optional() }).strict(),
  z.object({ topicId: entityIdSchema, specialtyId: z.never().optional() }).strict(),
]);
export const interestsReplaceSchema = z
  .object({ interests: z.array(interestTargetSchema).max(100) })
  .strict();
export const onboardingCompleteSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    locale: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    specialtyId: entityIdSchema,
    topicIds: z.array(entityIdSchema).max(100),
  })
  .strict();

export const readingProgressUpsertSchema = z
  .object({
    articleKey: articleKeySchema,
    progressPercent: z.number().min(0).max(100),
    minutesRead: z.number().int().min(0).max(1440).optional(),
    completed: z.boolean().optional(),
  })
  .strict();

export const libraryMutationSchema = z
  .object({
    articleKey: articleKeySchema,
    liked: z.boolean(),
    collectionIds: z.array(entityIdSchema).max(50),
  })
  .strict();

export const collectionCreateSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

export const noteCreateSchema = z
  .object({ articleKey: articleKeySchema, body: z.string().trim().min(1).max(20000) })
  .strict();
export const noteUpdateSchema = z
  .object({ noteId: entityIdSchema, body: z.string().trim().min(1).max(20000) })
  .strict();
export const noteDeleteSchema = z.object({ noteId: entityIdSchema }).strict();

export const entitlementKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9_.-]+$/);
export const entitlementReadSchema = z.object({ key: entitlementKeySchema }).strict();

export const notificationPreferencesSchema = z
  .object({
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    digestFrequency: z.enum(["off", "daily", "weekly"]),
    quietHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
  })
  .strict();

export const pushSubscriptionSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .max(2048)
      .refine((url) => url.startsWith("https://")),
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(512),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const pushUnsubscribeSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .max(2048)
      .refine((url) => url.startsWith("https://")),
  })
  .strict();

// Intentionally absent: schemas that let clients create subscriptions,
// payments, staff roles or entitlements. Those are server-owned resources.
