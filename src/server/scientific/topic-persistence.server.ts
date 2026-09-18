import "./server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TopicMatch } from "./topics";

/** Reconciles one ruleset; the editorial PK row always wins and is untouched. */
export async function reconcileAutomaticTopics(
  client: SupabaseClient,
  articleId: string,
  ruleVersion: string,
  matches: readonly TopicMatch[],
) {
  const wanted = new Set(matches.map((x) => x.topicId));
  const current = await client
    .from("article_topics")
    .select("topic_id,association_type,rule_version")
    .eq("article_id", articleId);
  if (current.error) throw current.error;
  for (const row of current.data ?? [])
    if (
      row.association_type === "automatic" &&
      row.rule_version === ruleVersion &&
      !wanted.has(row.topic_id)
    ) {
      const deleted = await client
        .from("article_topics")
        .delete()
        .eq("article_id", articleId)
        .eq("topic_id", row.topic_id)
        .eq("association_type", "automatic");
      if (deleted.error) throw deleted.error;
    }
  for (const match of matches) {
    const existing = (current.data ?? []).find((x) => x.topic_id === match.topicId);
    if (existing?.association_type === "editorial") continue;
    const result = await client
      .from("article_topics")
      .upsert(
        {
          article_id: articleId,
          topic_id: match.topicId,
          association_type: "automatic",
          confidence: match.confidence,
          method: match.method,
          evidence: match.evidence,
          rule_version: match.ruleVersion,
        },
        { onConflict: "article_id,topic_id" },
      );
    if (result.error) throw result.error;
  }
}
