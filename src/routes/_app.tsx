import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { useDose } from "@/lib/store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const hydrated = useDose((s) => s.hydrated);
  const complete = useDose((s) => s.profile.onboardingComplete);
  const plansSeen = useDose((s) => s.profile.planScreenSeen);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hydrated) return;
    if (!complete) {
      void navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (!plansSeen) {
      void navigate({ to: "/planos", replace: true });
    }
  }, [hydrated, complete, plansSeen, navigate]);

  if (!hydrated || !complete || !plansSeen) {
    return <div className="h-full min-h-0 flex-1 pay-sky" aria-busy="true" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-bg">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
