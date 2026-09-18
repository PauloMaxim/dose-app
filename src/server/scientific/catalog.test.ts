import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEGACY_SPECIALTY_SLUGS,
  LEGACY_TOPIC_SLUGS,
  SPECIALTY_V1,
  TOPIC_V1,
  legacySpecialtySlug,
  legacyStudyType,
  legacyTopicSlug,
} from "../../lib/scientific-catalog";

test("canonical V1 has fixed, unique UUID identities and preserved labels", () => {
  assert.equal(SPECIALTY_V1.length, 10);
  assert.equal(TOPIC_V1.length, 12);
  for (const rows of [SPECIALTY_V1, TOPIC_V1]) {
    assert.equal(new Set(rows.map((x) => x[0])).size, rows.length);
    assert.equal(new Set(rows.map((x) => x[1])).size, rows.length);
    assert.ok(rows.every((x) => /^[0-9a-f-]{36}$/.test(x[0])));
  }
  assert.deepEqual(
    Object.keys(LEGACY_SPECIALTY_SLUGS),
    SPECIALTY_V1.map((x) => x[2]),
  );
  assert.deepEqual(
    Object.keys(LEGACY_TOPIC_SLUGS),
    TOPIC_V1.map((x) => x[2]),
  );
  assert.notEqual(
    SPECIALTY_V1.find((x) => x[1] === "hepatologia")?.[0],
    TOPIC_V1.find((x) => x[1] === "hepatologia")?.[0],
  );
});
test("legacy aliases are exact and closed", () => {
  assert.equal(legacySpecialtySlug("Cardiologia"), "cardiologia");
  assert.equal(legacyTopicSlug("Insuficiência cardíaca"), "insuficiencia-cardiaca");
  assert.equal(legacySpecialtySlug("Cardio"), undefined);
  assert.equal(legacyTopicSlug("Insuficiência"), undefined);
});
test("transverse and related topics coexist", () => {
  assert.equal(TOPIC_V1.find((x) => x[1] === "vacinas-no-adulto")?.[3], null);
  assert.equal(
    TOPIC_V1.find((x) => x[1] === "diabetes")?.[3],
    SPECIALTY_V1.find((x) => x[1] === "endocrinologia")?.[0],
  );
});
test("study type compatibility does not overclaim Review", () => {
  assert.equal(legacyStudyType("RCT"), "randomized_trial");
  assert.equal(legacyStudyType("Meta-análise"), "meta_analysis");
  assert.equal(legacyStudyType("Guideline"), "guideline");
  assert.equal(legacyStudyType("Coorte"), "cohort");
  assert.equal(legacyStudyType("Review"), undefined);
});
test("migration is additive, null-rules, fixed and validates before deletion", async () => {
  const sql = await readFile(
    "supabase/migrations/202609230001_canonical_scientific_catalog.sql",
    "utf8",
  );
  assert.doesNotMatch(sql, /drop\s+(table|column)|truncate/i);
  assert.equal((sql.match(/,true,null\)/g) ?? []).length, 12);
  assert.ok(
    sql.indexOf("invalid or inactive specialty") < sql.indexOf("delete from public.user_interests"),
  );
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /on conflict \(id\) do nothing/g);
});
