import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-full overflow-y-auto bg-bg px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(32px,env(safe-area-inset-top))]">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
        <Link
          to="/onboarding"
          className="mb-10 text-lg font-semibold tracking-tight"
          aria-label="Dose — início"
        >
          Dose
        </Link>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}

export const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
