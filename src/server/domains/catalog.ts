import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../lib/auth/middleware";
import type { ScientificCatalog } from "../../lib/scientific-catalog";
import { getSupabaseUserClient } from "../db/supabase.server";

export async function readActiveCatalog(
  client: ReturnType<typeof getSupabaseUserClient>,
): Promise<ScientificCatalog> {
  const [specialties, topics] = await Promise.all([
    client.from("specialties").select("id,slug,name").eq("is_active", true).order("name"),
    client.from("topics").select("id,slug,name,specialty_id").eq("is_active", true).order("name"),
  ]);
  if (specialties.error || topics.error)
    throw new Error("Não foi possível carregar o catálogo científico.");
  return {
    specialties: (specialties.data ?? []).map((x) => ({ id: x.id, slug: x.slug, name: x.name })),
    topics: (topics.data ?? []).map((x) => ({
      id: x.id,
      slug: x.slug,
      name: x.name,
      specialtyId: x.specialty_id,
    })),
  };
}

export const readScientificCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => readActiveCatalog(getSupabaseUserClient(context.accessToken)));
