import { useContext } from "react";
import { AuthContext } from "./context";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: false;
};
export type CurrentUserState = { user: AppUser | null; isPending: boolean };

export function useCurrentUserState(): CurrentUserState {
  const { session, isPending } = useContext(AuthContext);
  const user = session?.user;
  return {
    user: user ? {
      id: user.id,
      displayName: (user.user_metadata.name as string | undefined) ?? (user.user_metadata.full_name as string | undefined) ?? null,
      primaryEmail: user.email ?? null,
      profileImageUrl: (user.user_metadata.avatar_url as string | undefined) ?? null,
      isDevFallback: false,
    } : null,
    isPending,
  };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
