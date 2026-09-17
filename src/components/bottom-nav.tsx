import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Home, User } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/artigos", label: "Artigos", icon: BookOpen, center: false },
  { to: "/", label: "Home", icon: Home, center: true },
  { to: "/perfil", label: "Perfil", icon: User, center: false },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  const labels = {
    "/artigos": t("nav.articles"),
    "/": t("nav.home"),
    "/perfil": t("nav.profile"),
  } as const;

  return (
    <nav
      data-tour="tour-nav"
      className="shrink-0 border-t border-border bg-bg/92 px-6 pt-2 backdrop-blur-md"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      aria-label="Navegação principal"
    >
      <ul className="flex items-end justify-between">
        {TABS.map((tab) => {
          const active =
            tab.to === "/"
              ? pathname === "/"
              : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.to} className="flex flex-1 justify-center">
              <Link
                to={tab.to}
                aria-label={labels[tab.to]}
                aria-current={active ? "page" : undefined}
                data-tour={
                  tab.to === "/"
                    ? "tour-nav-home"
                    : tab.to === "/artigos"
                      ? "tour-nav-artigos"
                      : "tour-nav-perfil"
                }
                className={cn(
                  "flex size-12 items-center justify-center rounded-2xl text-subtle transition-transform duration-200",
                  tab.center && "size-14 -translate-y-1 rounded-[18px]",
                  active && "tab-gradient text-on-accent shadow-[0_8px_20px_rgb(59_139_255/0.35)]",
                )}
              >
                <Icon
                  strokeWidth={active ? 2.2 : 1.7}
                  className={cn(tab.center ? "size-7" : "size-6")}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
