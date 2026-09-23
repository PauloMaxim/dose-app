import { scientificArticleIdSchema } from "@/server/scientific/article-detail";

export type ArticleRouteKind = "scientific" | "legacy" | "not-found";

/** UUIDs are classified before legacy lookup so they can never fall through to demo content. */
export function resolveArticleRouteKind(
  id: string,
  legacyArticleExists: (slug: string) => boolean,
): ArticleRouteKind {
  if (scientificArticleIdSchema.safeParse(id).success) return "scientific";
  return legacyArticleExists(id) ? "legacy" : "not-found";
}
