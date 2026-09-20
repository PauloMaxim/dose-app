// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  acceptCurrentLegalDocuments: vi.fn(),
}));

const security = vi.hoisted(() => ({
  session: null as Session | null,
  recoveryUserId: null as string | null,
  consumeRecovery: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authEnabled: false,
  signInWithPassword: auth.signInWithPassword,
  signUpWithPassword: auth.signUpWithPassword,
  requestPasswordReset: auth.requestPasswordReset,
  updatePassword: auth.updatePassword,
}));

vi.mock("@/server/domains/account", () => ({
  acceptCurrentLegalDocuments: auth.acceptCurrentLegalDocuments,
}));

import { AuthContext } from "@/lib/auth/context";
import { AppAccessContext } from "@/lib/auth/app-access-context";
import { AppRouteGate } from "@/lib/auth/app-route-gate";
import { Login } from "@/routes/login";
import { Signup } from "@/routes/auth.signup";
import { ResetPassword } from "@/routes/auth.reset-password";

async function renderAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <AuthContext.Provider
        value={{
          session: security.session,
          recoveryUserId: security.recoveryUserId,
          recoveryPending: Boolean(
            security.recoveryUserId && security.session?.user.id === security.recoveryUserId,
          ),
          callbackUserId: null,
          consumeRecovery: security.consumeRecovery,
          isPending: false,
        }}
      >
        <AppAccessContext.Provider
          value={{ remoteOnboarding: "idle", refreshRemoteProfile: async () => false }}
        >
          <Outlet />
        </AppAccessContext.Provider>
      </AuthContext.Provider>
    ),
  });
  const routePath = path.split("?")[0];
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: routePath,
    validateSearch: (search: Record<string, unknown>): { request?: 1 } => ({
      request: search.request === 1 || search.request === "1" ? 1 : undefined,
    }),
    component: () => {
      const { request } = route.useSearch() as { request?: 1 };
      if (routePath === "/login") return <Login />;
      if (routePath === "/auth/signup") return <Signup />;
      return <ResetPassword request={request === 1} />;
    },
  });
  const router = new (await import("@tanstack/react-router")).Router({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(router.state.status).toBe("idle"));
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  security.session = null;
  security.recoveryUserId = null;
  auth.signInWithPassword.mockResolvedValue({ error: new Error("expected test stop") });
  auth.signUpWithPassword.mockResolvedValue({ error: new Error("expected test stop") });
  auth.requestPasswordReset.mockResolvedValue({ error: null });
  auth.updatePassword.mockResolvedValue({ error: new Error("expected test stop") });
  auth.acceptCurrentLegalDocuments.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("critical auth forms", () => {
  it("submits login when Entrar is clicked", async () => {
    const user = userEvent.setup();
    await renderAt("/login");

    await user.type(screen.getByLabelText("E-mail"), "doctor@example.com");
    await user.type(screen.getByLabelText("Senha"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(auth.signInWithPassword).toHaveBeenCalledWith(
      "doctor@example.com",
      "correct horse battery staple",
    );
  });

  it("submits signup when Criar minha conta is clicked", async () => {
    const user = userEvent.setup();
    await renderAt("/auth/signup");

    await user.type(screen.getByLabelText("E-mail"), "new@example.com");
    await user.type(screen.getByLabelText("Senha"), "long-enough-password");
    await user.type(screen.getByLabelText("Confirmar senha"), "long-enough-password");
    await user.click(screen.getByRole("button", { name: "Criar minha conta" }));

    expect(auth.signUpWithPassword).toHaveBeenCalledWith(
      "new@example.com",
      "long-enough-password",
      undefined,
    );
  });

  it("renders and submits recovery request mode from typed router search", async () => {
    const user = userEvent.setup();
    await renderAt("/auth/reset-password?request=1");

    expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeTruthy();
    await user.type(screen.getByLabelText("E-mail"), "recover@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(auth.requestPasswordReset).toHaveBeenCalledWith("recover@example.com");
    expect(auth.updatePassword).not.toHaveBeenCalled();
  });

  it("reacts to Solicitar novo link navigation by entering request mode", async () => {
    const user = userEvent.setup();
    const router = await renderAt("/auth/reset-password");

    expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Solicitar novo link" }));

    await screen.findByRole("heading", { name: "Recuperar senha" });
    expect(router.state.location.search).toEqual({ request: 1 });
    expect(screen.getByRole("button", { name: "Enviar instruções" })).toBeTruthy();
  });

  it("updates a password only with matching PASSWORD_RECOVERY identity", async () => {
    security.session = { user: { id: "recovery-user" } } as Session;
    security.recoveryUserId = "recovery-user";
    const user = userEvent.setup();
    await renderAt("/auth/reset-password");

    await user.type(screen.getByLabelText("Nova senha"), "new-secure-password");
    await user.type(screen.getByLabelText("Confirmar senha"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(auth.updatePassword).toHaveBeenCalledWith("new-secure-password");
  });

  it("keeps recovery pending when the password update fails", async () => {
    security.session = { user: { id: "recovery-user" } } as Session;
    security.recoveryUserId = "recovery-user";
    const user = userEvent.setup();
    await renderAt("/auth/reset-password");

    await user.type(screen.getByLabelText("Nova senha"), "new-secure-password");
    await user.type(screen.getByLabelText("Confirmar senha"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(auth.updatePassword).toHaveBeenCalledWith("new-secure-password");
    expect(security.consumeRecovery).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("consumes recovery only after the password update succeeds", async () => {
    security.session = { user: { id: "recovery-user" } } as Session;
    security.recoveryUserId = "recovery-user";
    auth.updatePassword.mockImplementation(async () => {
      expect(security.consumeRecovery).not.toHaveBeenCalled();
      return { error: null };
    });
    const user = userEvent.setup();
    await renderAt("/auth/reset-password");

    await user.type(screen.getByLabelText("Nova senha"), "new-secure-password");
    await user.type(screen.getByLabelText("Confirmar senha"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(security.consumeRecovery).toHaveBeenCalledOnce();
  });

  it("rejects a recovery identity that differs from the session user", async () => {
    security.session = { user: { id: "signed-in-user" } } as Session;
    security.recoveryUserId = "other-user";
    await renderAt("/auth/reset-password");

    expect(screen.queryByRole("button", { name: "Atualizar senha" })).toBeNull();
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(security.consumeRecovery).not.toHaveBeenCalled();
  });

  it("does not authorize password updates from a normal session or request=1", async () => {
    security.session = { user: { id: "signed-in-user" } } as Session;
    await renderAt("/auth/reset-password");

    expect(screen.queryByRole("button", { name: "Atualizar senha" })).toBeNull();
    expect(screen.getByRole("link", { name: "Solicitar novo link" })).toBeTruthy();
    expect(auth.updatePassword).not.toHaveBeenCalled();

    cleanup();
    await renderAt("/auth/reset-password?request=1");
    expect(screen.queryByRole("button", { name: "Atualizar senha" })).toBeNull();
    expect(screen.getByRole("button", { name: "Enviar instruções" })).toBeTruthy();
    expect(auth.updatePassword).not.toHaveBeenCalled();
  });
});

async function renderGatedAt(path: string, remoteOnboarding: "complete" | "idle" = "complete") {
  const rootRoute = createRootRoute({
    component: () => (
      <AuthContext.Provider
        value={{
          session: security.session,
          recoveryUserId: security.recoveryUserId,
          recoveryPending: Boolean(
            security.recoveryUserId && security.session?.user.id === security.recoveryUserId,
          ),
          callbackUserId: null,
          consumeRecovery: security.consumeRecovery,
          isPending: false,
        }}
      >
        <AppAccessContext.Provider
          value={{ remoteOnboarding, refreshRemoteProfile: async () => false }}
        >
          <AppRouteGate>
            <Outlet />
          </AppRouteGate>
        </AppAccessContext.Provider>
      </AuthContext.Provider>
    ),
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <h1>Home protegida</h1>,
  });
  const articlesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/artigos",
    component: () => <h1>Artigos protegidos</h1>,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: Login,
  });
  const resetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/auth/reset-password",
    component: () => <h1>Corredor de recuperação</h1>,
  });
  const router = new (await import("@tanstack/react-router")).Router({
    routeTree: rootRoute.addChildren([homeRoute, articlesRoute, loginRoute, resetRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(router.state.status).toBe("idle"));
  return router;
}

describe("password recovery access corridor", () => {
  beforeEach(() => {
    security.session = { user: { id: "recovery-user", user_metadata: {} } } as Session;
    security.recoveryUserId = "recovery-user";
  });

  it("does not release Home even when remote onboarding is complete", async () => {
    const router = await renderGatedAt("/");

    await screen.findByRole("heading", { name: "Corredor de recuperação" });
    expect(router.state.location.pathname).toBe("/auth/reset-password");
    expect(screen.queryByRole("heading", { name: "Home protegida" })).toBeNull();
  });

  it("does not allow login to bypass pending recovery", async () => {
    const router = await renderGatedAt("/login");

    await screen.findByRole("heading", { name: "Corredor de recuperação" });
    expect(router.state.location.pathname).toBe("/auth/reset-password");
  });

  it("denies a manually entered protected route", async () => {
    const router = await renderGatedAt("/artigos");

    await screen.findByRole("heading", { name: "Corredor de recuperação" });
    expect(router.state.location.pathname).toBe("/auth/reset-password");
    expect(screen.queryByRole("heading", { name: "Artigos protegidos" })).toBeNull();
  });

  it("continues blocking protected routes after in-app navigation", async () => {
    const router = await renderGatedAt("/");
    await screen.findByRole("heading", { name: "Corredor de recuperação" });

    await router.navigate({ to: "/artigos" });

    await waitFor(() => expect(router.state.location.pathname).toBe("/auth/reset-password"));
    expect(screen.queryByRole("heading", { name: "Artigos protegidos" })).toBeNull();
  });

  it("keeps normal signed-in sessions on the ordinary access path", async () => {
    security.recoveryUserId = null;
    const router = await renderGatedAt("/");

    await screen.findByRole("heading", { name: "Home protegida" });
    expect(router.state.location.pathname).toBe("/");
  });
});
