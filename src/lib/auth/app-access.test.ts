import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { destinationAfterPlan, isProtectedAppPath, resolveAppAccessState } from "./app-access.ts";

describe("authenticated application boundary", () => {
  it("A. ignores completed local onboarding for a visitor", () => {
    assert.equal(
      resolveAppAccessState({
        sessionPending: false,
        hasUser: false,
        remoteOnboarding: "complete",
      }),
      "signed_out",
    );
  });

  it("B. an old browser flag cannot reopen Home", () => {
    assert.equal(isProtectedAppPath("/"), true);
    assert.equal(
      resolveAppAccessState({
        sessionPending: false,
        hasUser: false,
        remoteOnboarding: "idle",
      }),
      "signed_out",
    );
  });

  it("C/G. visitor completion and Free selection lead to authentication", () => {
    assert.equal(
      destinationAfterPlan({ hasUser: false, remoteOnboardingComplete: false }),
      "/login",
    );
  });

  it("D. authenticated user with remotely completed onboarding receives Home", () => {
    assert.equal(
      resolveAppAccessState({
        sessionPending: false,
        hasUser: true,
        remoteOnboarding: "complete",
      }),
      "ready",
    );
  });

  it("E. authenticated user with incomplete remote onboarding continues onboarding", () => {
    assert.equal(
      resolveAppAccessState({
        sessionPending: false,
        hasUser: true,
        remoteOnboarding: "incomplete",
      }),
      "onboarding_required",
    );
  });

  it("F. logout immediately revokes protected route access", () => {
    assert.equal(
      resolveAppAccessState({
        sessionPending: false,
        hasUser: false,
        remoteOnboarding: "idle",
      }),
      "signed_out",
    );
  });

  it("H. browser persistence cannot promote Premium", async () => {
    const store = await readFile(new URL("../store.ts", import.meta.url), "utf8");
    assert.match(store, /profile: \{ \.\.\.s\.profile, plan: "free" as const \}/);
    assert.doesNotMatch(store, /setPlan\s*\(|plan:\s*"premium"/);
  });

  it("I. remote persistence failure cannot produce ready access", () => {
    assert.equal(
      resolveAppAccessState({
        sessionPending: false,
        hasUser: true,
        remoteOnboarding: "error",
      }),
      "profile_error",
    );
  });

  it("J. session restore remains pending instead of redirecting", () => {
    assert.equal(
      resolveAppAccessState({
        sessionPending: true,
        hasUser: false,
        remoteOnboarding: "idle",
      }),
      "session_loading",
    );
  });

  it("protects every route that reads account-scoped application state", () => {
    for (const path of [
      "/",
      "/artigos",
      "/dashboard",
      "/insights",
      "/mascote",
      "/perfil",
      "/config",
      "/artigo/summit",
      "/edicao/today",
      "/ler/summit",
    ])
      assert.equal(isProtectedAppPath(path), true, path);
    for (const path of ["/login", "/onboarding", "/planos", "/pagamento"])
      assert.equal(isProtectedAppPath(path), false, path);
  });
});
