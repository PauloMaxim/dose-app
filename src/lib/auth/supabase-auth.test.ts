import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loginWithPassword,
  logoutSession,
  registerWithPassword,
  sendPasswordRecovery,
  setAccountPassword,
  type AuthActionPort,
} from "./auth-actions.ts";
import {
  interestsReplaceSchema,
  libraryMutationSchema,
  noteCreateSchema,
  profileUpdateSchema,
  readingProgressUpsertSchema,
} from "../../server/api/contracts.ts";
import { verifyAccessToken } from "./verify.server.ts";

function fakeAuth() {
  const calls: Array<{ name: string; input?: unknown }> = [];
  const auth: AuthActionPort = {
    async signUp(input) {
      calls.push({ name: "signUp", input });
      return { data: { user: { id: "a" } }, error: null };
    },
    async signInWithPassword(input) {
      calls.push({ name: "signIn", input });
      return { data: { user: { id: "a" } }, error: null };
    },
    async signOut() {
      calls.push({ name: "signOut" });
      return { error: null };
    },
    async resetPasswordForEmail(email, options) {
      calls.push({ name: "reset", input: { email, options } });
      return { error: null };
    },
    async updateUser(input) {
      calls.push({ name: "updateUser", input });
      return { data: { user: { id: "a" } }, error: null };
    },
  };
  return { auth, calls };
}

test("cadastro encaminha identidade e metadados de perfil", async () => {
  const { auth, calls } = fakeAuth();
  await registerWithPassword(
    auth,
    "a@example.test",
    "password1",
    "https://dose.test/auth/confirm",
    "Ana",
  );
  assert.deepEqual(calls[0], {
    name: "signUp",
    input: {
      email: "a@example.test",
      password: "password1",
      options: {
        emailRedirectTo: "https://dose.test/auth/confirm",
        data: { name: "Ana", full_name: "Ana" },
      },
    },
  });
});

test("login, logout, recuperação e atualização usam apenas a API Auth", async () => {
  const { auth, calls } = fakeAuth();
  await loginWithPassword(auth, "a@example.test", "password1");
  await logoutSession(auth);
  await sendPasswordRecovery(auth, "a@example.test", "https://dose.test/auth/reset-password");
  await setAccountPassword(auth, "password2");
  assert.deepEqual(
    calls.map((call) => call.name),
    ["signIn", "signOut", "reset", "updateUser"],
  );
});

test("contratos de perfil e interesses não aceitam user_id do cliente", () => {
  assert.equal(
    profileUpdateSchema.safeParse({ displayName: "A", user_id: crypto.randomUUID() }).success,
    false,
  );
  assert.equal(
    interestsReplaceSchema.safeParse({ interests: [], userId: crypto.randomUUID() }).success,
    false,
  );
});

test("contratos de conteúdo rejeitam identidade e campos de autoridade do cliente", () => {
  assert.equal(
    libraryMutationSchema.safeParse({
      articleKey: "summit",
      liked: true,
      collectionIds: [],
      userId: crypto.randomUUID(),
    }).success,
    false,
  );
  assert.equal(
    readingProgressUpsertSchema.safeParse({
      articleKey: "summit",
      progressPercent: 10,
      user_id: crypto.randomUUID(),
    }).success,
    false,
  );
  assert.equal(
    noteCreateSchema.safeParse({ articleKey: "summit", body: "nota", plan: "premium" }).success,
    false,
  );
  assert.equal(
    readingProgressUpsertSchema.safeParse({ articleKey: "summit", progressPercent: 101 }).success,
    false,
  );
});

test("sessão válida deriva identidade do token validado", async () => {
  const user = await verifyAccessToken("valid", async (token) =>
    token === "valid"
      ? { id: "10000000-0000-0000-0000-000000000001", email: "a@example.test" }
      : null,
  );
  assert.equal(user?.id, "10000000-0000-0000-0000-000000000001");
});

test("sessão ausente ou inválida não produz identidade", async () => {
  assert.equal(await verifyAccessToken(undefined, async () => ({ id: "forged" })), null);
  assert.equal(await verifyAccessToken("invalid", async () => null), null);
});
