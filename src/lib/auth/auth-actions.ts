export type AuthErrorLike = { message: string; status?: number; code?: string } | null;
export interface AuthActionPort {
  signUp(input: {
    email: string;
    password: string;
    options: { data?: Record<string, string>; emailRedirectTo?: string };
  }): Promise<{ data: { user: unknown; session?: unknown | null }; error: AuthErrorLike }>;
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<{ data: { user: unknown }; error: AuthErrorLike }>;
  signOut(): Promise<{ error: AuthErrorLike }>;
  resetPasswordForEmail(
    email: string,
    options: { redirectTo: string },
  ): Promise<{ error: AuthErrorLike }>;
  updateUser(input: {
    password?: string;
    email?: string;
  }): Promise<{ data: { user: unknown }; error: AuthErrorLike }>;
}

export const registerWithPassword = (
  auth: AuthActionPort,
  email: string,
  password: string,
  redirectTo: string,
  displayName?: string,
) =>
  auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      ...(displayName ? { data: { name: displayName, full_name: displayName } } : {}),
    },
  });

export const loginWithPassword = (auth: AuthActionPort, email: string, password: string) =>
  auth.signInWithPassword({ email, password });

export const logoutSession = (auth: AuthActionPort) => auth.signOut();

export const sendPasswordRecovery = (auth: AuthActionPort, email: string, redirectTo: string) =>
  auth.resetPasswordForEmail(email, { redirectTo });

export const setAccountPassword = (auth: AuthActionPort, password: string) =>
  auth.updateUser({ password });
