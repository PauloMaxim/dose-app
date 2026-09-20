import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { maskEmail, safeReturnTo } from "./auth-flow.ts";

describe("Auth V1 security boundaries", () => {
  it("accepts only same-origin relative return destinations", () => {
    assert.equal(safeReturnTo("/artigos?f=1"), "/artigos?f=1");
    for (const unsafe of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "javascript:alert(1)",
    ])
      assert.equal(safeReturnTo(unsafe), "/");
  });
  it("masks an email without hiding its destination domain", () => {
    assert.equal(maskEmail("ana@example.test"), "an••@example.test");
  });
  it("keeps recovery and confirmation off the login route", async () => {
    const client = await readFile(new URL("./client.ts", import.meta.url), "utf8");
    assert.match(client, /auth\/reset-password/);
    assert.match(client, /auth\/confirm/);
    assert.doesNotMatch(client, /localhost/);
  });
  it("implements remote deletion only in a server module", async () => {
    const account = await readFile(
      new URL("../../server/domains/account.ts", import.meta.url),
      "utf8",
    );
    assert.match(account, /auth\.admin\.deleteUser\(context\.userId\)/);
    assert.match(account, /authMiddleware/);
  });
  it("stores versioned legal acceptance behind auth.uid and RLS", async () => {
    const migration = await readFile(
      new URL(
        "../../../supabase/migrations/202610010001_auth_v1_legal_acceptances.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(migration, /terms_version text not null/);
    assert.match(migration, /privacy_version text not null/);
    assert.match(migration, /alter table public\.legal_acceptances enable row level security/);
    assert.match(migration, /values \(auth\.uid\(\), '2026-09-20', '2026-09-20'\)/);
    assert.doesNotMatch(migration, /grant (insert|update|delete).*authenticated/i);
  });
});
