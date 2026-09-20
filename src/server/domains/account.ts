import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../lib/auth/middleware";
import { getSupabaseAdminClient, getSupabaseUserClient } from "../db/supabase.server";

/** Records the versions accepted by the authenticated caller; identity is never client supplied. */
export const acceptCurrentLegalDocuments = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { error } = await getSupabaseUserClient(context.accessToken).rpc(
      "accept_current_legal_documents",
    );
    if (error) throw new Error("Não foi possível registrar o aceite dos documentos.");
    return { ok: true as const };
  });

/** Privileged deletion stays server-only and uses the verified session user id. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { error } = await getSupabaseAdminClient().auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Não foi possível excluir sua conta agora.");
    return { ok: true as const };
  });
