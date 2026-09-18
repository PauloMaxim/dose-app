import { z } from "zod";
import { getSupabaseAdminClient } from "../db/supabase.server";

export const staffRoleSchema = z.enum(["admin", "support", "billing", "editor"]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export interface AuthenticatedPrincipal {
  userId: string;
}

export function requireAuthenticatedPrincipal(
  userId: string | null | undefined,
): AuthenticatedPrincipal {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) throw new Error("Authentication required.");
  return { userId: parsed.data };
}

/** Server-side staff guard for privileged routes that use the service role. */
export async function requireStaffRole(
  principal: AuthenticatedPrincipal,
  allowedRoles: readonly StaffRole[],
): Promise<StaffRole> {
  const { data, error } = await getSupabaseAdminClient()
    .from("staff_roles")
    .select("role")
    .eq("user_id", principal.userId);

  if (error) throw new Error("Unable to verify staff authorization.");
  const role = data
    ?.map((row) => staffRoleSchema.safeParse(row.role))
    .find((result) => result.success && allowedRoles.includes(result.data));

  if (!role?.success) throw new Error("Insufficient permissions.");
  return role.data;
}
