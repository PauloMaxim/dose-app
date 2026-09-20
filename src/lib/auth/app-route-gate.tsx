import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAppAccess } from "./app-access-context";
import { isProtectedAppPath, resolveAppAccessState } from "./app-access";
import { useCurrentUserState } from "./use-current-user";

export function AppRouteGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const { remoteOnboarding } = useAppAccess();

  if (!isProtectedAppPath(pathname)) return <>{children}</>;

  const access = resolveAppAccessState({
    sessionPending: isPending,
    hasUser: Boolean(user),
    remoteOnboarding,
  });
  if (access === "signed_out") return <Navigate to="/login" replace />;
  if (access === "onboarding_required") return <Navigate to="/onboarding" replace />;
  if (access === "ready") return <>{children}</>;

  return (
    <main className="grid h-full place-items-center bg-bg" aria-busy="true">
      <p className="text-sm text-muted">
        {access === "profile_error"
          ? "Não foi possível validar seu perfil. Recarregue para tentar novamente."
          : "Validando sua sessão…"}
      </p>
    </main>
  );
}
