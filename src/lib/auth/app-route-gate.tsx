import { Navigate, useRouterState } from "@tanstack/react-router";
import { useContext, type ReactNode } from "react";
import { useAppAccess } from "./app-access-context";
import { isProtectedAppPath, resolveAppAccessState } from "./app-access";
import { useCurrentUserState } from "./use-current-user";
import { AuthContext } from "./context";

export function AppRouteGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const { recoveryPending } = useContext(AuthContext);
  const { remoteOnboarding } = useAppAccess();

  if (recoveryPending && (pathname === "/login" || isProtectedAppPath(pathname))) {
    return <Navigate to="/auth/reset-password" replace />;
  }
  if (!isProtectedAppPath(pathname)) return <>{children}</>;

  const access = resolveAppAccessState({
    sessionPending: isPending,
    hasUser: Boolean(user),
    remoteOnboarding,
  });
  if (access === "signed_out") {
    const returnTo = pathname === "/" ? undefined : pathname;
    return <Navigate to="/login" search={returnTo ? ({ returnTo } as never) : undefined} replace />;
  }
  if (access === "onboarding_required") return <Navigate to="/onboarding" replace />;
  if (access === "ready") return <>{children}</>;

  return (
    <main className="grid h-full place-items-center bg-bg" aria-busy="true">
      <div className="px-6 text-center">
        <p className="text-sm text-muted">
          {access === "profile_error"
            ? "Não foi possível validar seu perfil. Recarregue para tentar novamente."
            : "Validando sua sessão…"}
        </p>
        {access === "profile_error" && (
          <button
            type="button"
            className="mt-4 min-h-11 rounded-xl bg-card px-5 text-sm font-medium"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </main>
  );
}
