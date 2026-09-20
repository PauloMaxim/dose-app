import { useEffect, useState } from "react";
import { AppTour } from "@/components/app-tour";
import { useDose } from "@/lib/store";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const setHydrated = useDose((s) => s.setHydrated);
  const hydrated = useDose((s) => s.hydrated);
  const theme = useDose((s) => s.profile.theme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const result = useDose.persist.rehydrate();
    void Promise.resolve(result).then(() => {
      setHydrated();
      setReady(true);
    });
  }, [setHydrated]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      const vv = window.visualViewport;
      const h = Math.round(vv?.height ?? window.innerHeight);
      const top = Math.round(vv?.offsetTop ?? 0);
      root.style.setProperty("--vv-height", `${h}px`);
      root.style.setProperty("--vv-offset", `${top}px`);
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("scroll", apply, { passive: true });
    const recenter = () => {
      window.setTimeout(apply, 50);
      window.setTimeout(apply, 280);
    };
    window.addEventListener("focusout", recenter);
    window.addEventListener("focusin", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("scroll", apply);
      window.removeEventListener("focusout", recenter);
      window.removeEventListener("focusin", apply);
    };
  }, []);

  return (
    <div className="phone-shell relative flex flex-col overflow-hidden">
      <div className="flex h-full min-h-0 flex-1 flex-col">{children}</div>
      <AppTour />
      {!hydrated && !ready && <Splash />}
    </div>
  );
}

function Splash() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-bg">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl tab-gradient">
        <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
          <path d="M16 4c6 7 10 11 10 16a10 10 0 1 1-20 0c0-5 4-9 10-16Z" fill="white" />
          <path
            d="M8 19h4l2-4 3 8 2-4h5"
            stroke="#0A0A0B"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
      <p className="text-lg font-semibold tracking-tight">Dose</p>
      <p className="mt-1 text-xs text-muted">evidência diária para médicos</p>
    </div>
  );
}
