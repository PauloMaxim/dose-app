/**
 * Optional OAuth providers offered through Supabase Auth.
 *
 * Source of truth for the existing sign-in buttons and client redirect.
 *
 * Provider secrets are configured in Supabase and never enter this repository.
 *
 * A provider is exposed only after it is both enabled in Supabase and opted in
 * through its public feature flag. Provider secrets never enter this app.
 */
export type GrokProvider = {
  /** Stable id used by the UI. */
  providerId: string;
  /** Supabase OAuth provider id. */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
};

const CONFIGURED_PROVIDERS: readonly GrokProvider[] = [
  { providerId: "google", idp: "google", label: "Google" },
  { providerId: "twitter", idp: "twitter", label: "X" },
];

const enabledProviderIds = new Set([
  ...(import.meta.env.VITE_SUPABASE_OAUTH_GOOGLE_ENABLED === "true" ? ["google"] : []),
  ...(import.meta.env.VITE_SUPABASE_OAUTH_X_ENABLED === "true" ? ["twitter"] : []),
]);

export const GROK_PROVIDERS: readonly GrokProvider[] = CONFIGURED_PROVIDERS.filter(
  ({ providerId }) => enabledProviderIds.has(providerId),
);
