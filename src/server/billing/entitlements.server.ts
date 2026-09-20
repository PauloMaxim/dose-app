import "../scientific/server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { billingFeatureSchema, type BillingFeature } from "./domain";
import type { AuthenticatedPrincipal } from "../auth/authorization.server";

export interface ActiveEntitlement {
  feature: BillingFeature;
  source: string;
  startsAt: string;
  endsAt: string | null;
}

export async function getUserEntitlements(
  client: SupabaseClient,
  principal: AuthenticatedPrincipal,
  now = new Date(),
): Promise<ActiveEntitlement[]> {
  const { data, error } = await client
    .from("entitlements")
    .select("key, source, starts_at, ends_at")
    .eq("user_id", principal.userId)
    .eq("status", "active")
    .lte("starts_at", now.toISOString())
    .or(`ends_at.is.null,ends_at.gt.${now.toISOString()}`);
  if (error) throw new Error("Unable to verify entitlements.");
  return (data ?? []).flatMap((row) => {
    const feature = billingFeatureSchema.safeParse(row.key);
    return feature.success
      ? [
          {
            feature: feature.data,
            source: row.source,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
          },
        ]
      : [];
  });
}

export async function hasEntitlement(
  client: SupabaseClient,
  principal: AuthenticatedPrincipal,
  feature: BillingFeature,
  now?: Date,
): Promise<boolean> {
  return (await getUserEntitlements(client, principal, now)).some(
    (item) => item.feature === feature,
  );
}

export async function requireEntitlement(
  client: SupabaseClient,
  principal: AuthenticatedPrincipal,
  feature: BillingFeature,
): Promise<void> {
  if (!(await hasEntitlement(client, principal, feature))) throw new Error("Entitlement required.");
}
