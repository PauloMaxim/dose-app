import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  canResetPassword,
  callbackDestination,
  confirmationRedirectPath,
  friendlyAuthError,
  legalReturnPath,
  maskEmail,
  RECOVERY_SUCCESS_DESTINATION,
  safeReturnTo,
} from "./auth-flow.ts";
import { finishConfirmedIdentity, resolveConfirmedCallbackKind } from "./auth-callback.ts";
import { reduceAuthSecurityState } from "./context.ts";
import { privateCacheMustReset } from "./app-access.ts";
import type { Session } from "@supabase/supabase-js";

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
  it("a normal authenticated session never authorizes password recovery", () => {
    const session = { user: { id: "normal-user" } } as Session;
    const state = reduceAuthSecurityState(
      { recoveryUserId: null, callbackUserId: null },
      "SIGNED_IN",
      session,
    );
    assert.equal(state.recoveryUserId, null);
    assert.equal(canResetPassword(state.recoveryUserId, session.user.id), false);
  });
  it("PASSWORD_RECOVERY authorizes only the matching user and is consumed on sign-out", () => {
    const session = { user: { id: "recovery-user" } } as Session;
    const recovered = reduceAuthSecurityState(
      { recoveryUserId: null, callbackUserId: null },
      "PASSWORD_RECOVERY",
      session,
      true,
    );
    assert.equal(canResetPassword(recovered.recoveryUserId, "recovery-user"), true);
    assert.equal(canResetPassword(recovered.recoveryUserId, "other-user"), false);
    assert.equal(reduceAuthSecurityState(recovered, "SIGNED_OUT", null).recoveryUserId, null);
    assert.equal(recovered.callbackUserId, "recovery-user");
    assert.equal(RECOVERY_SUCCESS_DESTINATION, "/onboarding");
  });
  it("rejects a forged recovery kind unless Supabase proves the recovery redirect type", () => {
    assert.throws(() =>
      resolveConfirmedCallbackKind({
        requestedKind: "recovery",
        redirectType: null,
        otpType: null,
      }),
    );
    assert.equal(
      resolveConfirmedCallbackKind({
        requestedKind: "recovery",
        redirectType: "recovery",
        otpType: null,
      }),
      "recovery",
    );
    assert.equal(callbackDestination("recovery"), "/auth/reset-password");
  });
  it("maps expired, invalid, and already-used links to non-technical errors", () => {
    assert.match(friendlyAuthError(new Error("link expired")), /expirou/);
    assert.match(friendlyAuthError(new Error("invalid token")), /não é válido/);
    assert.match(
      friendlyAuthError(new Error("invalid link already used")),
      /não é válido|utilizado/,
    );
  });
  it("signup confirmation and resend both register legal acceptance", async () => {
    assert.equal(confirmationRedirectPath("signup"), "/auth/confirm?kind=signup");
    for (const source of ["initial", "resend"]) {
      let accepts = 0;
      const kind = resolveConfirmedCallbackKind({
        requestedKind: "signup",
        redirectType: "signup",
        otpType: source,
      });
      const result = await finishConfirmedIdentity(kind, async () => {
        accepts += 1;
      });
      assert.equal(accepts, 1);
      assert.deepEqual(result, { status: "ready", destination: "/onboarding" });
    }
  });
  it("reports post-confirmation acceptance failure separately from link failure", async () => {
    const result = await finishConfirmedIdentity("signup", async () => {
      throw new Error("database unavailable");
    });
    assert.deepEqual(result, { status: "post-confirm-error" });
  });
  it("email change returns through the protected app boundary, not onboarding directly", async () => {
    const result = await finishConfirmedIdentity("email-change", async () => undefined);
    assert.deepEqual(result, { status: "ready", destination: "/" });
  });
  it("legal pages return only to deterministic internal origins", () => {
    assert.equal(legalReturnPath("config"), "/config");
    assert.equal(legalReturnPath("signup"), "/auth/signup");
    assert.equal(legalReturnPath("https://evil.test"), "/auth/signup");
  });
  it("invalidates private cache for logout and A-to-B transitions", () => {
    assert.equal(privateCacheMustReset("user-a", null), true);
    assert.equal(privateCacheMustReset(null, "user-b"), true);
    assert.equal(privateCacheMustReset("user-a", "user-b"), true);
    assert.equal(privateCacheMustReset("user-b", "user-b"), false);
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
