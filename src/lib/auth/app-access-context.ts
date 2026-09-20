import { createContext, useContext } from "react";
import type { RemoteOnboardingState } from "./app-access";

export type AppAccessContextValue = {
  remoteOnboarding: RemoteOnboardingState;
  refreshRemoteProfile: () => Promise<boolean>;
};

export const AppAccessContext = createContext<AppAccessContextValue>({
  remoteOnboarding: "idle",
  refreshRemoteProfile: async () => false,
});

export function useAppAccess() {
  return useContext(AppAccessContext);
}
