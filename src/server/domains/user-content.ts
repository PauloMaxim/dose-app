import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../../lib/auth/middleware";
import {
  collectionCreateSchema,
  libraryMutationSchema,
  noteCreateSchema,
  noteDeleteSchema,
  noteUpdateSchema,
  readingProgressUpsertSchema,
} from "../api/contracts";
import { getSupabaseUserClient } from "../db/supabase.server";

type UserClient = ReturnType<typeof getSupabaseUserClient>;

async function articleMap(client: UserClient) {
  const { data, error } = await client
    .from("article_sources")
    .select("article_id, external_id")
    .eq("provider", "dose_catalog");
  if (error) throw new Error("Não foi possível resolver o catálogo de artigos.");
  return new Map((data ?? []).map((row) => [row.article_id as string, row.external_id as string]));
}

export const readMyContent = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const client = getSupabaseUserClient(context.accessToken);
    const [keys, savedResult, linksResult, progressResult, notesResult, collectionsResult] = await Promise.all([
      articleMap(client),
      client.from("saved_articles").select("article_id, liked, created_at").eq("user_id", context.userId),
      client.from("saved_article_collections").select("article_id, collection_id").eq("user_id", context.userId),
      client.from("reading_progress").select("article_id, progress_percent, minutes_read, started_at, completed_at, updated_at").eq("user_id", context.userId),
      client.from("article_notes").select("id, article_id, body, created_at, updated_at").eq("user_id", context.userId).order("updated_at", { ascending: false }),
      client.from("user_collections").select("id, name, is_default, created_at, updated_at").eq("user_id", context.userId).order("created_at", { ascending: true }),
    ]);
    for (const result of [savedResult, linksResult, progressResult, notesResult, collectionsResult]) {
      if (result.error) throw new Error("Não foi possível carregar os dados de leitura.");
    }
    const collectionsByArticle = new Map<string, string[]>();
    for (const link of linksResult.data ?? []) {
      const list = collectionsByArticle.get(link.article_id) ?? [];
      list.push(link.collection_id);
      collectionsByArticle.set(link.article_id, list);
    }
    return {
      saved: (savedResult.data ?? []).flatMap((row) => {
        const articleKey = keys.get(row.article_id);
        return articleKey ? [{ articleKey, liked: row.liked, collectionIds: collectionsByArticle.get(row.article_id) ?? [], createdAt: row.created_at }] : [];
      }),
      progress: (progressResult.data ?? []).flatMap((row) => {
        const articleKey = keys.get(row.article_id);
        return articleKey ? [{ articleKey, progressPercent: Number(row.progress_percent), minutesRead: row.minutes_read, startedAt: row.started_at, completedAt: row.completed_at, updatedAt: row.updated_at }] : [];
      }),
      notes: (notesResult.data ?? []).flatMap((row) => {
        const articleKey = keys.get(row.article_id);
        return articleKey ? [{ id: row.id, articleKey, body: row.body, createdAt: row.created_at, updatedAt: row.updated_at }] : [];
      }),
      collections: collectionsResult.data ?? [],
    };
  });

export const setMyLibraryEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => libraryMutationSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { error } = await getSupabaseUserClient(context.accessToken).rpc("set_my_library_entry", {
      article_key: input.articleKey,
      is_liked: input.liked,
      collection_ids: input.collectionIds,
    });
    if (error) throw new Error("Não foi possível atualizar a biblioteca.");
    return { ok: true as const };
  });

export const createMyCollection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => collectionCreateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const client = getSupabaseUserClient(context.accessToken);
    const normalized = input.name.trim().toLowerCase();
    const existing = await client.from("user_collections").select("id, name, is_default").eq("user_id", context.userId).eq("name_normalized", normalized).maybeSingle();
    if (existing.error) throw new Error("Não foi possível verificar a coleção.");
    if (existing.data) return existing.data;
    const created = await client.from("user_collections").insert({ user_id: context.userId, name: input.name.trim() }).select("id, name, is_default").single();
    if (created.error) throw new Error("Não foi possível criar a coleção.");
    return created.data;
  });

export const upsertMyReadingProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => readingProgressUpsertSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const client = getSupabaseUserClient(context.accessToken);
    const { data, error } = await client.rpc("upsert_my_reading_progress", {
      article_key: input.articleKey,
      new_progress: input.progressPercent,
      new_minutes: input.minutesRead ?? 0,
      mark_completed: input.completed ?? false,
    }).single();
    if (error || !data) throw new Error("Não foi possível salvar o progresso.");
    const row = data as {
      progress_percent: number | string;
      minutes_read: number;
      started_at: string | null;
      completed_at: string | null;
      updated_at: string;
    };
    return {
      articleKey: input.articleKey,
      progressPercent: Number(row.progress_percent),
      minutesRead: row.minutes_read,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    };
  });

export const createMyNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => noteCreateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const client = getSupabaseUserClient(context.accessToken);
    const source = await client.from("article_sources").select("article_id").eq("provider", "dose_catalog").eq("external_id", input.articleKey).single();
    if (source.error || !source.data) throw new Error("Artigo não encontrado.");
    const result = await client.from("article_notes").insert({ user_id: context.userId, article_id: source.data.article_id, body: input.body }).select("id, body, created_at, updated_at").single();
    if (result.error) throw new Error("Não foi possível salvar a nota.");
    return { id: result.data.id, articleKey: input.articleKey, body: result.data.body, createdAt: result.data.created_at, updatedAt: result.data.updated_at };
  });

export const updateMyNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => noteUpdateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const result = await getSupabaseUserClient(context.accessToken).from("article_notes").update({ body: input.body }).eq("id", input.noteId).eq("user_id", context.userId).select("id").single();
    if (result.error) throw new Error("Não foi possível atualizar a nota.");
    return { ok: true as const };
  });

export const deleteMyNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => noteDeleteSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const result = await getSupabaseUserClient(context.accessToken).from("article_notes").delete().eq("id", input.noteId).eq("user_id", context.userId);
    if (result.error) throw new Error("Não foi possível excluir a nota.");
    return { ok: true as const };
  });
