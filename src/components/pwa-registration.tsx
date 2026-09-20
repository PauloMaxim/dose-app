import { useEffect } from "react";

/** Registration only: notification permission always remains behind explicit UI action. */
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
