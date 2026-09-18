import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db;

async function asRole(role, userId, operation) {
  await db.exec(`set role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    return await operation();
  } finally {
    await db.exec("reset role");
  }
}

before(async () => {
  db = new PGlite();
  await db.waitReady;
  await db.exec(`
    create schema extensions;
    create schema auth;
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table auth.users (
      id uuid primary key,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);

  let migration = await readFile(
    new URL("../supabase/migrations/202609170001_foundation.sql", import.meta.url),
    "utf8",
  );
  // PGlite has gen_random_uuid built in but does not package pgcrypto. This is
  // the sole compatibility transform; Supabase runs the unmodified migration.
  migration = migration
    .replace("create extension if not exists pgcrypto with schema extensions;", "")
    .replaceAll("extensions.gen_random_uuid()", "gen_random_uuid()");
  await db.exec(migration);
  const identityMigration = await readFile(
    new URL("../supabase/migrations/202609180001_identity_operations.sql", import.meta.url),
    "utf8",
  );
  await db.exec(identityMigration);
  let contentMigration = await readFile(
    new URL("../supabase/migrations/202609190001_user_content.sql", import.meta.url),
    "utf8",
  );
  contentMigration = contentMigration.replaceAll("extensions.gen_random_uuid()", "gen_random_uuid()");
  await db.exec(contentMigration);

  await db.exec(`
    insert into auth.users (id, raw_user_meta_data) values
      ('10000000-0000-0000-0000-000000000001', '{"name":"A"}'),
      ('20000000-0000-0000-0000-000000000002', '{"name":"B"}'),
      ('30000000-0000-0000-0000-000000000003', '{"name":"Staff"}');
    insert into public.staff_roles (user_id, role)
      values ('30000000-0000-0000-0000-000000000003', 'admin');
    insert into public.plans (id, code, name)
      values ('40000000-0000-0000-0000-000000000004', 'free', 'Free');
    insert into public.specialties (id, slug, name)
      values ('80000000-0000-0000-0000-000000000008', 'cardiologia', 'Cardiologia');
    insert into public.articles (id, title)
      values ('50000000-0000-0000-0000-000000000005', 'RLS test');
    insert into public.saved_articles (user_id, article_id)
      values ('20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005');
    insert into public.subscriptions (id, user_id, plan_id, provider, external_id, status)
      values ('60000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'test', 'sub_b', 'active');
    insert into public.payments (id, user_id, provider, status, amount_minor, currency)
      values ('70000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'test', 'succeeded', 1000, 'BRL');
  `);
});

after(async () => {
  await db?.close();
});

test("user A cannot read user B private data", async () => {
  await asRole("authenticated", "10000000-0000-0000-0000-000000000001", async () => {
    assert.equal((await db.query("select * from public.profiles where id = '20000000-0000-0000-0000-000000000002'")).rows.length, 0);
    assert.equal((await db.query("select * from public.saved_articles")).rows.length, 0);
    assert.equal((await db.query("select * from public.subscriptions")).rows.length, 0);
    assert.equal((await db.query("select * from public.payments")).rows.length, 0);
  });
});

for (const [label, ownId, otherId] of [
  ["A", "10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000002"],
  ["B", "20000000-0000-0000-0000-000000000002", "10000000-0000-0000-0000-000000000001"],
]) {
  test(`user ${label} reads own profile and preferences but not the other user`, async () => {
    await asRole("authenticated", ownId, async () => {
      assert.equal((await db.query("select * from public.profiles where id = $1", [ownId])).rows.length, 1);
      assert.equal((await db.query("select * from public.notification_preferences where user_id = $1", [ownId])).rows.length, 1);
      assert.equal((await db.query("select * from public.profiles where id = $1", [otherId])).rows.length, 0);
    });
  });
}

test("user A cannot alter user B profile", async () => {
  await asRole("authenticated", "10000000-0000-0000-0000-000000000001", async () => {
    const result = await db.query(
      "update public.profiles set display_name = 'intrusion' where id = $1 returning id",
      ["20000000-0000-0000-0000-000000000002"],
    );
    assert.equal(result.rows.length, 0);
  });
  const profile = await db.query("select display_name from public.profiles where id = $1", [
    "20000000-0000-0000-0000-000000000002",
  ]);
  assert.equal(profile.rows[0].display_name, "B");
});

test("user B cannot alter user A profile", async () => {
  await asRole("authenticated", "20000000-0000-0000-0000-000000000002", async () => {
    const result = await db.query(
      "update public.profiles set display_name = 'intrusion' where id = $1 returning id",
      ["10000000-0000-0000-0000-000000000001"],
    );
    assert.equal(result.rows.length, 0);
  });
});

for (const [operation, statement] of [
  ["insert entitlement", "insert into public.entitlements (user_id, key) values ('10000000-0000-0000-0000-000000000001', 'dose.plus')"],
  ["update entitlement", "update public.entitlements set status = 'revoked'"],
  ["delete entitlement", "delete from public.entitlements"],
  ["insert subscription", "insert into public.subscriptions (user_id, plan_id, provider, external_id, status) values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'test', 'forged', 'active')"],
  ["update subscription", "update public.subscriptions set status = 'canceled'"],
  ["delete subscription", "delete from public.subscriptions"],
  ["insert payment", "insert into public.payments (user_id, provider, status, amount_minor, currency) values ('10000000-0000-0000-0000-000000000001', 'test', 'succeeded', 1000, 'BRL')"],
  ["update payment", "update public.payments set status = 'refunded'"],
  ["delete payment", "delete from public.payments"],
]) {
  test(`authenticated user cannot ${operation}`, async () => {
    await assert.rejects(
      asRole("authenticated", "10000000-0000-0000-0000-000000000001", () =>
        db.exec(statement),
      ),
      /permission denied|row-level security/i,
    );
  });
}

test("anonymous role cannot access private data", async () => {
  await assert.rejects(
    asRole("anon", null, () => db.query("select * from public.profiles")),
    /permission denied/i,
  );
});

test("interest replacement always derives the owner from auth.uid", async () => {
  await asRole("authenticated", "10000000-0000-0000-0000-000000000001", () =>
    db.query("select public.replace_my_interests($1::uuid[], $2::uuid[])", [
      ["80000000-0000-0000-0000-000000000008"],
      [],
    ]),
  );
  const rows = await db.query("select user_id from public.user_interests");
  assert.deepEqual(rows.rows.map((row) => row.user_id), ["10000000-0000-0000-0000-000000000001"]);
});

test("library writes are idempotent and scoped to the authenticated user", async () => {
  const collection = await asRole("authenticated", "10000000-0000-0000-0000-000000000001", async () => {
    const own = await db.query("select id from public.user_collections where is_default");
    const id = own.rows[0].id;
    await db.query("select public.set_my_library_entry($1, $2, $3::uuid[])", ["summit", false, [id]]);
    await db.query("select public.set_my_library_entry($1, $2, $3::uuid[])", ["summit", false, [id]]);
    assert.equal((await db.query("select * from public.saved_articles")).rows.length, 1);
    assert.equal((await db.query("select * from public.saved_article_collections")).rows.length, 1);
    return id;
  });
  await asRole("authenticated", "20000000-0000-0000-0000-000000000002", async () => {
    assert.equal((await db.query("select * from public.saved_articles where article_id = public.resolve_dose_article('summit')")).rows.length, 0);
    await assert.rejects(
      db.query("select public.set_my_library_entry($1, $2, $3::uuid[])", ["summit", false, [collection]]),
      /invalid collection|row-level security/i,
    );
  });
  await asRole("authenticated", "10000000-0000-0000-0000-000000000001", async () => {
    await db.query("select public.set_my_library_entry($1, $2, $3::uuid[])", ["summit", false, []]);
    assert.equal((await db.query("select * from public.saved_articles where article_id = public.resolve_dose_article('summit')")).rows.length, 0);
  });
});

test("reading progress is per-user, idempotent and never moves backwards", async () => {
  await asRole("authenticated", "10000000-0000-0000-0000-000000000001", async () => {
    await db.query("select public.upsert_my_reading_progress($1, $2, $3, $4)", ["select", 60, 0, false]);
    await db.query("select public.upsert_my_reading_progress($1, $2, $3, $4)", ["select", 20, 0, false]);
    const own = await db.query("select progress_percent from public.reading_progress where article_id = public.resolve_dose_article('select')");
    assert.equal(Number(own.rows[0].progress_percent), 60);
  });
  await asRole("authenticated", "20000000-0000-0000-0000-000000000002", async () => {
    assert.equal((await db.query("select * from public.reading_progress where article_id = public.resolve_dose_article('select')")).rows.length, 0);
    await db.query("select public.upsert_my_reading_progress($1, $2, $3, $4)", ["select", 30, 0, false]);
    assert.equal((await db.query("select * from public.reading_progress where article_id = public.resolve_dose_article('select')")).rows.length, 1);
  });
});

test("notes are private and another user cannot read or change them", async () => {
  const noteId = await asRole("authenticated", "10000000-0000-0000-0000-000000000001", async () => {
    const article = await db.query("select public.resolve_dose_article('sprint') id");
    const inserted = await db.query("insert into public.article_notes (article_id, body) values ($1, 'private A') returning id", [article.rows[0].id]);
    return inserted.rows[0].id;
  });
  await asRole("authenticated", "20000000-0000-0000-0000-000000000002", async () => {
    assert.equal((await db.query("select * from public.article_notes where id = $1", [noteId])).rows.length, 0);
    assert.equal((await db.query("update public.article_notes set body = 'forged' where id = $1 returning id", [noteId])).rows.length, 0);
  });
});

test("authorized staff can inspect operational data", async () => {
  await asRole("authenticated", "30000000-0000-0000-0000-000000000003", async () => {
    assert.equal((await db.query("select * from public.subscriptions")).rows.length, 1);
    assert.equal((await db.query("select * from public.staff_roles")).rows.length, 1);
  });
});

test("staff still cannot grant roles through client privileges", async () => {
  await assert.rejects(
    asRole("authenticated", "30000000-0000-0000-0000-000000000003", () =>
      db.exec(
        "insert into public.staff_roles (user_id, role) values ('10000000-0000-0000-0000-000000000001', 'admin')",
      ),
    ),
    /permission denied|row-level security/i,
  );
});
