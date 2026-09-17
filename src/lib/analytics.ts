export type AnalyticsEvent =
  | "onboarding_view"
  | "onboarding_continue"
  | "onboarding_skip"
  | "onboarding_complete"
  | "onboarding_reminder_prompt"
  | "onboarding_reminder_result";

export function track(
  name: AnalyticsEvent,
  props?: Record<string, string | number | boolean | null>,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("dose:analytics", {
      detail: { name, props, t: Date.now() },
    }),
  );
}
