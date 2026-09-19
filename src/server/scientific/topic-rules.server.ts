import "./server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { topicRuleSnapshotSchema } from "./scientific-read-api.server";
import { storedTopicRuleSchema } from "./topic-rule-contract";
import type { TopicRule } from "./topics";

interface TopicRuleRow {
  id: string;
  specialty_id: string | null;
  is_active: boolean;
  classification_rules: unknown;
}

/** Converts trusted active catalog rows into classifier rules. Invalid rules reject the whole snapshot. */
export function parseActiveTopicRules(
  rows: readonly TopicRuleRow[],
  activeSpecialtyIds: ReadonlySet<string>,
): TopicRule[] {
  return rows.flatMap((row) => {
    if (!row.is_active) return [];
    if (row.classification_rules == null) return [];
    if (row.specialty_id !== null && !activeSpecialtyIds.has(row.specialty_id)) return [];
    const stored = storedTopicRuleSchema.parse(row.classification_rules);
    return [{ ...stored, topicId: row.id, specialtyId: row.specialty_id }];
  });
}

/** Loads a fail-closed, immutable snapshot; topic and specialty identities always come from catalog rows. */
export async function loadActiveTopicRules(client: SupabaseClient): Promise<TopicRule[]> {
  const result = await client.rpc("read_scientific_topic_rule_snapshot");
  if (result.error) throw new Error("Não foi possível carregar as regras temáticas.");
  const rows = topicRuleSnapshotSchema.parse(result.data);
  const activeSpecialtyIds = new Set(
    rows
      .filter((row) => row.specialty_id !== null && row.specialty_is_active)
      .map((row) => row.specialty_id as string),
  );
  return parseActiveTopicRules(
    rows.map((row) => ({
      id: row.topic_id,
      specialty_id: row.specialty_id,
      is_active: row.topic_is_active,
      classification_rules: row.classification_rules,
    })),
    activeSpecialtyIds,
  );
}
