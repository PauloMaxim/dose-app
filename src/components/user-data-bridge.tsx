import { useEffect } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useDose } from "@/lib/store";
import { refreshMyContent } from "@/lib/user-content";
import { readMyProfile } from "@/server/domains/user-data";

export function UserDataBridge() {
  const { user } = useCurrentUserState();
  const hydrated = useDose((state) => state.hydrated);

  useEffect(() => {
    if (!user || !hydrated) return;
    let active = true;
    void (async () => {
      const remote = await readMyProfile();
      if (!active) return;
      // The persisted Zustand store predates user ownership and can contain
      // another person's data on a shared browser. It is therefore read only
      // as a UI cache here and is never promoted automatically to Supabase.
      // Explicit authenticated mutations (onboarding/settings) remain the only
      // client path that writes profile data for the verified current session.
      useDose.getState().updateProfile({
        name: remote.display_name ?? user.displayName ?? "Colega",
        locale: remote.locale?.toLowerCase().startsWith("en") ? "en" : "pt",
        onboardingComplete: Boolean(remote.onboarding_completed_at),
        plan: "free",
      });
      await refreshMyContent(user.id);
    })().catch(() => undefined);
    return () => { active = false; };
  }, [hydrated, user]);

  return null;
}
