import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL("../supabase/migrations/202609170001_foundation.sql", import.meta.url);
const envExampleUrl = new URL("../.env.example", import.meta.url);
const contentMigrationUrl = new URL(
  "../supabase/migrations/202609190001_user_content.sql",
  import.meta.url,
);
const appAccessProviderUrl = new URL("../src/lib/auth/app-access-provider.tsx", import.meta.url);
const providerUrl = new URL("../src/lib/auth/provider.tsx", import.meta.url);
const oauthProvidersUrl = new URL("../src/lib/auth/providers.ts", import.meta.url);
const userContentUrl = new URL("../src/lib/user-content.ts", import.meta.url);
const storeUrl = new URL("../src/lib/store.ts", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");
const envExample = await readFile(envExampleUrl, "utf8");
const contentSql = await readFile(contentMigrationUrl, "utf8");
const appAccessProvider = await readFile(appAccessProviderUrl, "utf8");
const authProvider = await readFile(providerUrl, "utf8");
const oauthProviders = await readFile(oauthProvidersUrl, "utf8");
const userContent = await readFile(userContentUrl, "utf8");
const store = await readFile(storeUrl, "utf8");

const privateTables = [
  "profiles",
  "user_interests",
  "saved_articles",
  "reading_progress",
  "notification_preferences",
  "push_subscriptions",
  "subscriptions",
  "payments",
  "entitlements",
  "staff_roles",
];

test("every private table enables RLS", () => {
  for (const table of privateTables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
});

test("user-owned policies derive identity from auth.uid()", () => {
  for (const table of privateTables.slice(0, 6)) {
    const policyBlock = sql.match(
      new RegExp(`create policy ${table}_[\\s\\S]*?(?=create policy|-- Billing)`, "g"),
    );
    assert.ok(
      policyBlock?.some((block) => block.includes("auth.uid()")),
      table,
    );
  }
});

test("billing, entitlement and staff mutations are not granted to clients", () => {
  assert.match(
    sql,
    /revoke insert, update, delete on public\.subscriptions, public\.payments,[\s\S]*public\.staff_roles from authenticated;/,
  );
  for (const table of ["subscriptions", "payments", "entitlements", "staff_roles"]) {
    assert.doesNotMatch(
      sql,
      new RegExp(`create policy ${table}_[^\\n]+ for (insert|update|delete)`),
    );
  }
});

test("deduplication and ownership constraints are present", () => {
  assert.match(sql, /unique \(provider, external_id\)/);
  assert.match(sql, /unique \(provider, event_id\)/);
  assert.match(sql, /primary key \(user_id, article_id\)/);
  assert.match(sql, /articles_doi_normalized_uidx/);
  assert.match(sql, /articles_pmid_uidx/);
});

test("environment template contains names only, never assigned values", () => {
  for (const line of envExample.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [, value = ""] = line.split("=", 2);
    assert.equal(value, "", `${line.split("=", 1)[0]} must not contain a value`);
  }
});

test("legacy local profile is never promoted automatically to an authenticated account", () => {
  assert.doesNotMatch(appAccessProvider, /updateMyProfile|localStorage\.setItem/);
  assert.match(appAccessProvider, /readMyProfile/);
});

test("OAuth providers fail closed unless explicitly enabled", () => {
  assert.match(oauthProviders, /VITE_SUPABASE_OAUTH_GOOGLE_ENABLED === "true"/);
  assert.match(oauthProviders, /VITE_SUPABASE_OAUTH_X_ENABLED === "true"/);
});

test("session restoration settles pending state after an Auth error", () => {
  assert.match(authProvider, /\.catch\(\(\) =>/);
  assert.match(authProvider, /\.finally\(\(\) =>/);
});

test("user content tables have ownership policies and authenticated grants", () => {
  for (const table of ["user_collections", "saved_article_collections", "article_notes"]) {
    assert.match(
      contentSql,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
    assert.match(
      contentSql,
      new RegExp(`create policy ${table}_select_own[\\s\\S]*?auth\\.uid\\(\\)`),
    );
  }
  assert.match(
    contentSql,
    /foreign key \(user_id, article_id\)[\s\S]*references public\.saved_articles/,
  );
  assert.match(
    contentSql,
    /greatest\(public\.reading_progress\.progress_percent, excluded\.progress_percent\)/,
  );
});

test("legacy migration is non-destructive and remote content remains authoritative", () => {
  assert.match(userContent, /dose-legacy-content-v1/);
  assert.doesNotMatch(userContent, /localStorage\.removeItem|clearStorage/);
  assert.match(
    userContent,
    /const snapshot = await readMyContent\(\);[\s\S]*applyRemoteContent\(snapshot\)/,
  );
});

test("browser storage cannot restore premium authority", () => {
  assert.doesNotMatch(store, /plan:\s*parsePlan/);
  assert.match(store, /profile: \{ \.\.\.s\.profile, plan: "free" as const \}/);
});
