import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../lib/auth/middleware";
import {
  interestsReplaceSchema,
  onboardingCompleteSchema,
  profileUpdateSchema,
} from "../api/contracts";
import { getSupabaseUserClient } from "../db/supabase.server";

export const readMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { data, error } = await getSupabaseUserClient(context.accessToken)
      .from("profiles")
      .select(
        "id, display_name, avatar_path, locale, timezone, onboarding_completed_at, created_at, updated_at",
      )
      .eq("id", context.userId)
      .single();
    if (error) throw new Error("Não foi possível carregar o perfil.");
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => profileUpdateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const update = {
      ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
      ...(input.avatarPath !== undefined ? { avatar_path: input.avatarPath } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.onboardingCompleted !== undefined
        ? { onboarding_completed_at: input.onboardingCompleted ? new Date().toISOString() : null }
        : {}),
    };
    const { data, error } = await getSupabaseUserClient(context.accessToken)
      .from("profiles")
      .update(update)
      .eq("id", context.userId)
      .select(
        "id, display_name, avatar_path, locale, timezone, onboarding_completed_at, created_at, updated_at",
      )
      .single();
    if (error) throw new Error("Não foi possível atualizar o perfil.");
    return data;
  });

export const readMyInterests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { data, error } = await getSupabaseUserClient(context.accessToken)
      .from("user_interests")
      .select("id, specialty_id, topic_id, created_at")
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível carregar os interesses.");
    return data ?? [];
  });

export const replaceMyInterests = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => interestsReplaceSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const specialtyIds = input.interests.flatMap((item) =>
      "specialtyId" in item ? [item.specialtyId] : [],
    );
    const topicIds = input.interests.flatMap((item) => ("topicId" in item ? [item.topicId] : []));
    const { error } = await getSupabaseUserClient(context.accessToken).rpc("replace_my_interests", {
      specialty_ids: specialtyIds,
      topic_ids: topicIds,
    });
    if (error) throw new Error("Não foi possível atualizar os interesses.");
    return { ok: true as const };
  });

/** One DB transaction: validated active interests are written before onboarding is marked complete. */
export const completeMyOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => onboardingCompleteSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { error } = await getSupabaseUserClient(context.accessToken).rpc(
      "complete_my_onboarding",
      {
        display_name_input: input.displayName,
        locale_input: input.locale,
        specialty_id_input: input.specialtyId,
        topic_ids_input: input.topicIds,
      },
    );
    if (error) throw new Error("Não foi possível salvar seus interesses. Tente novamente.");
    return { ok: true as const };
  });

export const readMyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { data, error } = await getSupabaseUserClient(context.accessToken)
      .from("notification_preferences")
      .select(
        "email_enabled, push_enabled, digest_frequency, quiet_hours_start, quiet_hours_end, updated_at",
      )
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error("Não foi possível carregar as preferências.");
    return data;
  });
