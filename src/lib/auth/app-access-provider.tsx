import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDose } from "../store";
import { refreshMyContent } from "../user-content";
import { readMyProfile } from "../../server/domains/user-data";
import { privateCacheMustReset, type RemoteOnboardingState } from "./app-access";
import { AppAccessContext } from "./app-access-context";
import { useCurrentUserState } from "./use-current-user";

export function AppAccessProvider({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const userDisplayName = user?.displayName ?? null;
  const hydrated = useDose((state) => state.hydrated);
  const [remoteOnboarding, setRemoteOnboarding] = useState<RemoteOnboardingState>("idle");
  const requestId = useRef(0);
  const cacheOwner = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (isPending || !hydrated || !privateCacheMustReset(cacheOwner.current, userId)) return;
    requestId.current += 1;
    useDose.getState().clearPrivateSessionCache();
    cacheOwner.current = userId;
  }, [hydrated, isPending, userId]);

  const refreshRemoteProfile = useCallback(async () => {
    if (!userId) return false;
    const currentRequest = ++requestId.current;
    setRemoteOnboarding("loading");
    try {
      const remote = await readMyProfile();
      if (currentRequest !== requestId.current) return false;
      const complete = Boolean(remote.onboarding_completed_at);
      // Browser state remains a presentation cache. Only this authenticated,
      // server-derived profile result may update the cached completion flag.
      useDose.getState().applyRemoteProfile({
        name: remote.display_name ?? userDisplayName ?? "Colega",
        locale: remote.locale?.toLowerCase().startsWith("en") ? "en" : "pt",
        onboardingComplete: complete,
      });
      setRemoteOnboarding(complete ? "complete" : "incomplete");
      return complete;
    } catch {
      if (currentRequest === requestId.current) setRemoteOnboarding("error");
      return false;
    }
  }, [userDisplayName, userId]);

  useEffect(() => {
    if (isPending || !hydrated) return;
    if (!userId) {
      requestId.current += 1;
      setRemoteOnboarding("idle");
      return;
    }
    void refreshRemoteProfile();
    void refreshMyContent(userId).catch(() => undefined);
  }, [hydrated, isPending, refreshRemoteProfile, userId]);

  const value = useMemo(
    () => ({ remoteOnboarding, refreshRemoteProfile }),
    [refreshRemoteProfile, remoteOnboarding],
  );
  return <AppAccessContext.Provider value={value}>{children}</AppAccessContext.Provider>;
}
