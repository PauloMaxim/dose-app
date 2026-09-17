import { useEffect } from "react";
import { todayGoalMet, useDose } from "@/lib/store";
import { todayIso } from "@/lib/utils";

export function ReminderHost() {
  const hour = useDose((s) => s.profile.reminderHour);
  const minute = useDose((s) => s.profile.reminderMinute);
  const logs = useDose((s) => s.logs);
  const last = useDose((s) => s.lastReminderDate);
  const mark = useDose((s) => s.markReminderFired);
  const complete = useDose((s) => s.profile.onboardingComplete);

  useEffect(() => {
    if (!complete || hour == null) return;
    if (typeof Notification === "undefined") return;

    function tick() {
      if (Notification.permission !== "granted") return;
      if (todayGoalMet(logs)) return;
      const now = new Date();
      if (now.getHours() !== hour) return;
      if (now.getMinutes() < (minute || 0)) return;
      const today = todayIso();
      if (last === today) return;
      try {
        new Notification("Dose", {
          body: "A edição de hoje ainda está aberta.",
          icon: "/favicon.svg",
        });
      } catch {
        /* ignore */
      }
      mark(today);
    }

    tick();
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [complete, hour, minute, logs, last, mark]);

  return null;
}
