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
  if (!ruleVersion.trim()) throw new TypeError("ruleVersion must not be empty");
  if (matches.some((match) => match.ruleVersion !== ruleVersion))
    throw new TypeError("all matches must use the expected rule version");
  if (new Set(matches.map((match) => match.topicId)).size !== matches.length)
    throw new TypeError("matches must contain unique topic IDs");

  const result = await client.rpc("reconcile_automatic_article_topics", {
    p_article_id: articleId,
    p_rule_version: ruleVersion,
    p_matches: matches.map((match) => ({
      topic_id: match.topicId,
      confidence: match.confidence,
      method: match.method,
      evidence: match.evidence,
      rule_version: match.ruleVersion,
    })),
  });
  if (result.error) throw result.error;
}
