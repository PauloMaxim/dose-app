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
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  acceptCurrentLegalDocuments: vi.fn(),
  reconcileEmailConfirmation: vi.fn(),
}));

const supabase = vi.hoisted(() => {
  const listeners: Array<(event: string, session: Session | null) => void> = [];
  return {
    listeners,
    getSession: vi.fn(),
    getUser: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    onAuthStateChange: vi.fn((callback: (event: string, session: Session | null) => void) => {
      listeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(() => {
              const index = listeners.indexOf(callback);
              if (index >= 0) listeners.splice(index, 1);
            }),
          },
        },
      };
    }),
  };
});

const security = vi.hoisted(() => ({
  session: null as Session | null,
  recoveryUserId: null as string | null,
  consumeRecovery: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authEnabled: true,
  signInWithPassword: auth.signInWithPassword,
  signUpWithPassword: auth.signUpWithPassword,
  requestPasswordReset: auth.requestPasswordReset,
  updatePassword: auth.updatePassword,
  reconcileEmailConfirmation: auth.reconcileEmailConfirmation,
  resendSignup: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ auth: supabase }),
}));

vi.mock("@/server/domains/account", () => ({
  acceptCurrentLegalDocuments: auth.acceptCurrentLegalDocuments,
}));

import { AuthContext } from "@/lib/auth/context";
import { AppAccessContext } from "@/lib/auth/app-access-context";
import { AppRouteGate } from "@/lib/auth/app-route-gate";
import { AuthProvider } from "@/lib/auth/provider";
import { Login } from "@/routes/login";
import { Signup } from "@/routes/auth.signup";
import { ResetPassword } from "@/routes/auth.reset-password";
import { Confirm } from "@/routes/auth.confirm";
import { VerifyEmail } from "@/routes/auth.verify-email";

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
          hasRecoveryProof: (userId) => security.recoveryUserId === userId,
          hasCallbackProof: () => false,
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
      if (routePath === "/auth/verify-email") return <VerifyEmail />;
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
  auth.reconcileEmailConfirmation.mockResolvedValue({ status: "signed-out" });
  supabase.listeners.splice(0);
  supabase.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabase.getUser.mockResolvedValue({ data: { user: null }, error: null });
  supabase.exchangeCodeForSession.mockReset();
});

describe("email confirmation reconciliation", () => {
  it("does not grant a session when confirmation happened on another device", async () => {
    sessionStorage.setItem("dose-auth-email", "doctor@example.com");
    const user = userEvent.setup();
    await renderAt("/auth/verify-email");

    await user.click(screen.getByRole("button", { name: "Já confirmei" }));

    expect(auth.reconcileEmailConfirmation).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(
        "A confirmação feita em outro dispositivo não conecta esta aba. Entre com seu e-mail e senha para continuar.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar para entrar" })).toBeTruthy();
    expect(security.session).toBeNull();
  });

  it("does not treat an unconfirmed revalidated identity as success", async () => {
    auth.reconcileEmailConfirmation.mockResolvedValue({ status: "unconfirmed" });
    const user = userEvent.setup();
    await renderAt("/auth/verify-email");

    await user.click(screen.getByRole("button", { name: "Já confirmei" }));

    expect(
      await screen.findByText(/identidade desta sessão ainda não está confirmada/),
    ).toBeTruthy();
  });
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

describe("signup validation and password UX", () => {
  async function fillValidSignup(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("E-mail"), "doctor@example.com");
    await user.type(screen.getByLabelText("Senha"), "DoseTeste#9264");
    await user.type(screen.getByLabelText("Confirmar senha"), "DoseTeste#9264");
  }

  it("rejects mismatched passwords locally and submits once after correction", async () => {
    const user = userEvent.setup();
    await renderAt("/auth/signup");
    await user.type(screen.getByLabelText("E-mail"), "doctor@example.com");
    await user.type(screen.getByLabelText("Senha"), "DoseTeste#9264");
    await user.type(screen.getByLabelText("Confirmar senha"), "DoseTeste#9265");

    await user.click(screen.getByRole("button", { name: "Criar minha conta" }));

    expect(screen.getByText("As senhas não coincidem.")).toBeTruthy();
    expect(screen.queryByText(/Muitas tentativas/)).toBeNull();
    expect(auth.signUpWithPassword).not.toHaveBeenCalled();

    const confirmation = screen.getByLabelText("Confirmar senha");
    await user.clear(confirmation);
    await user.type(confirmation, "DoseTeste#9264");
    expect(screen.queryByText("As senhas não coincidem.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Criar minha conta" }));
    expect(auth.signUpWithPassword).toHaveBeenCalledOnce();
  });

  it("rejects a password below the actual minimum without a request", async () => {
    const user = userEvent.setup();
    await renderAt("/auth/signup");
    await user.type(screen.getByLabelText("E-mail"), "doctor@example.com");
    await user.type(screen.getByLabelText("Senha"), "short");
    await user.type(screen.getByLabelText("Confirmar senha"), "short");

    await user.click(screen.getByRole("button", { name: "Criar minha conta" }));

    expect(screen.getByText("Use uma senha com pelo menos 8 caracteres.")).toBeTruthy();
    expect(auth.signUpWithPassword).not.toHaveBeenCalled();
  });

  it("blocks rapid double clicks while signup is pending", async () => {
    let resolveSignup!: (value: { error: Error }) => void;
    auth.signUpWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignup = resolve;
      }),
    );
    const user = userEvent.setup();
    await renderAt("/auth/signup");
    await fillValidSignup(user);

    await user.dblClick(screen.getByRole("button", { name: "Criar minha conta" }));

    expect(auth.signUpWithPassword).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Criando…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    resolveSignup({ error: new Error("recoverable") });
    await screen.findByRole("alert");
  });

  it("blocks repeated Enter submissions while signup is pending", async () => {
    let resolveSignup!: (value: { error: Error }) => void;
    auth.signUpWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignup = resolve;
      }),
    );
    const user = userEvent.setup();
    await renderAt("/auth/signup");
    await fillValidSignup(user);

    await user.keyboard("{Enter}{Enter}");

    expect(auth.signUpWithPassword).toHaveBeenCalledOnce();
    resolveSignup({ error: new Error("recoverable") });
    await screen.findByRole("alert");
  });

  it.each([
    ["Senha", "senha"],
    ["Confirmar senha", "confirmação de senha"],
  ])("keeps the visibility control for %s after blur", async (fieldName, controlName) => {
    const user = userEvent.setup();
    await renderAt("/auth/signup");
    const input = screen.getByLabelText(fieldName) as HTMLInputElement;
    await user.type(input, "DoseTeste#9264");
    const show = screen.getByRole("button", { name: `Mostrar ${controlName}` });

    await user.click(show);
    expect(input.type).toBe("text");
    expect(input.value).toBe("DoseTeste#9264");
    await user.click(screen.getByLabelText("E-mail"));

    const hide = screen.getByRole("button", { name: `Ocultar ${controlName}` });
    expect(input.value).toBe("DoseTeste#9264");
    await user.click(hide);
    expect(input.type).toBe("password");
    expect(auth.signUpWithPassword).not.toHaveBeenCalled();
  });

  it("shows a real rate limit without clearing fields or retrying automatically", async () => {
    auth.signUpWithPassword.mockResolvedValue({
      error: Object.assign(new Error("request rejected"), {
        status: 429,
        code: "over_email_send_rate_limit",
      }),
    });
    const user = userEvent.setup();
    await renderAt("/auth/signup");
    await fillValidSignup(user);

    await user.click(screen.getByRole("button", { name: "Criar minha conta" }));

    expect(
      await screen.findByText(
        "Muitas tentativas em pouco tempo. Aguarde um momento antes de tentar novamente.",
      ),
    ).toBeTruthy();
    expect(auth.signUpWithPassword).toHaveBeenCalledOnce();
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("doctor@example.com");
    expect((screen.getByLabelText("Senha") as HTMLInputElement).value).toBe("DoseTeste#9264");
    expect((screen.getByLabelText("Confirmar senha") as HTMLInputElement).value).toBe(
      "DoseTeste#9264",
    );
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
          hasRecoveryProof: (userId) => security.recoveryUserId === userId,
          hasCallbackProof: () => false,
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

describe("integrated password recovery callback", () => {
  async function renderFailedCallback(session: Session | null) {
    const rootRoute = createRootRoute({
      component: () => (
        <AuthContext.Provider
          value={{
            session,
            recoveryUserId: null,
            recoveryPending: false,
            callbackUserId: null,
            hasRecoveryProof: () => false,
            hasCallbackProof: () => false,
            consumeRecovery: vi.fn(),
            isPending: false,
          }}
        >
          <Outlet />
        </AuthContext.Provider>
      ),
    });
    const confirmRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/auth/confirm",
      component: Confirm,
    });
    const resetRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/auth/reset-password",
      component: () => <h1>Reset indevido</h1>,
    });
    const router = new (await import("@tanstack/react-router")).Router({
      routeTree: rootRoute.addChildren([confirmRoute, resetRoute]),
      history: createMemoryHistory({ initialEntries: ["/auth/confirm"] }),
    });
    window.history.replaceState({}, "", "/auth/confirm?kind=recovery&code=failed-code");
    render(<RouterProvider router={router} />);
    return router;
  }

  it("keeps a genuinely invalid recovery callback on the error screen", async () => {
    supabase.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid link already used"),
    });
    await renderFailedCallback(null);

    await screen.findByRole("heading", { name: "Não foi possível confirmar" });
    expect(screen.queryByRole("heading", { name: "Reset indevido" })).toBeNull();
  });

  it("does not promote a normal session from the recovery query parameter", async () => {
    const normalSession = { user: { id: "normal-user", user_metadata: {} } } as Session;
    supabase.exchangeCodeForSession.mockResolvedValue({
      data: { user: normalSession.user },
      error: null,
    });
    supabase.getUser.mockResolvedValue({ data: { user: normalSession.user }, error: null });
    await renderFailedCallback(normalSession);

    await screen.findByRole("heading", { name: "Não foi possível confirmar" });
    expect(screen.queryByRole("heading", { name: "Reset indevido" })).toBeNull();
  });

  it("reconciles provider proof when the exchange reports its own code as invalid", async () => {
    const recoverySession = {
      user: { id: "callback-recovery-user", user_metadata: {} },
    } as Session;
    supabase.getUser.mockResolvedValue({ data: { user: recoverySession.user }, error: null });
    supabase.exchangeCodeForSession.mockImplementation(async () => {
      // The provider was mounted on the preceding route. Deliberately deliver
      // the event only to it to exercise the callback-listener race fallback.
      supabase.listeners[0]?.("PASSWORD_RECOVERY", recoverySession);
      return { data: { user: null }, error: new Error("invalid link already used") };
    });
    auth.updatePassword.mockResolvedValue({ error: null });

    const rootRoute = createRootRoute({
      component: () => (
        <AuthProvider>
          <AppAccessContext.Provider
            value={{ remoteOnboarding: "complete", refreshRemoteProfile: async () => true }}
          >
            <RecoveryState />
            <AppRouteGate>
              <Outlet />
            </AppRouteGate>
          </AppAccessContext.Provider>
        </AuthProvider>
      ),
    });
    const startRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/start",
      component: () => <h1>Início</h1>,
    });
    const confirmRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/auth/confirm",
      component: Confirm,
    });
    const resetRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/auth/reset-password",
      component: () => <ResetPassword request={false} />,
    });
    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <h1>Home integrada</h1>,
    });
    const router = new (await import("@tanstack/react-router")).Router({
      routeTree: rootRoute.addChildren([startRoute, confirmRoute, resetRoute, homeRoute]),
      history: createMemoryHistory({ initialEntries: ["/start"] }),
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Início" });
    await waitFor(() => expect(supabase.listeners).toHaveLength(1));

    window.history.replaceState({}, "", "/auth/confirm?kind=recovery&code=legitimate-code");
    await router.navigate({ to: "/auth/confirm" });

    await screen.findByRole("heading", { name: "Criar nova senha" });
    expect(screen.queryByRole("heading", { name: "Não foi possível confirmar" })).toBeNull();
    expect(router.state.location.pathname).toBe("/auth/reset-password");
    expect(screen.getByTestId("recovery-state").textContent).toBe("pending");
    expect(screen.queryByRole("heading", { name: "Home integrada" })).toBeNull();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nova senha"), "new-secure-password");
    await user.type(screen.getByLabelText("Confirmar senha"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(auth.updatePassword).toHaveBeenCalledWith("new-secure-password");
    await waitFor(() => expect(screen.getByTestId("recovery-state").textContent).toBe("clear"));

    await router.navigate({ to: "/" });
    await screen.findByRole("heading", { name: "Home integrada" });
  });
});

function RecoveryState() {
  const { recoveryPending } = useContext(AuthContext);
  return <output data-testid="recovery-state">{recoveryPending ? "pending" : "clear"}</output>;
}
