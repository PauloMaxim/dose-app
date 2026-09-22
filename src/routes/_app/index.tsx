import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Lock, Settings } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ScientificFeedCard, ScientificFeedStatus } from "@/components/scientific-feed";
import { isPremium } from "@/lib/premium";
import { useScientificFeed } from "@/lib/use-scientific-feed";
import { useDose } from "@/lib/store";
import { greetingForHour } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: HomePage,
});

function HomePage() {
  const profile = useDose((s) => s.profile);
  const scientificFeed = useScientificFeed(5);
  const hour = new Date().getHours();
  const greet = greetingForHour(hour, profile.locale);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-5 pb-8 pt-3">
      <header className="mb-5 flex items-center justify-between gap-3" data-tour="tour-header">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={profile.name} src={profile.avatar} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold leading-tight">
              {profile.title} {profile.name}
            </p>
            <Link
              to="/dashboard"
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted"
            >
              <LayoutDashboard className="size-3" />
              Dashboard
              {!isPremium(profile.plan) && <Lock className="size-3" />}
            </Link>
          </div>
        </div>
        <Link
          to="/config"
          aria-label="Configurações"
          className="flex size-11 items-center justify-center rounded-full bg-card text-muted"
        >
          <Settings className="size-5" />
        </Link>
      </header>

      <p className="mb-4 text-sm text-muted">
        {greet}, {profile.title} {profile.name.split(" ")[0]}.
      </p>

      <section data-tour="tour-edition" aria-labelledby="scientific-update-title">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Sua Dose</p>
        <h2 id="scientific-update-title" className="mt-1 text-[26px] font-semibold tracking-tight">
          Atualização científica
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Literatura priorizada pela correspondência com seus interesses.
        </p>
        <div className="mt-4 space-y-3">
          {scientificFeed.status === "loading" && <ScientificFeedStatus status="loading" />}
          {scientificFeed.status === "error" && (
            <ScientificFeedStatus status="error" onRetry={scientificFeed.retry} />
          )}
          {scientificFeed.status === "ready" && scientificFeed.items.length === 0 && (
            <ScientificFeedStatus status="empty" />
          )}
          {scientificFeed.status === "ready" &&
            scientificFeed.items.map((item) => (
              <ScientificFeedCard key={item.id} item={item} compact />
            ))}
        </div>
      </section>
    </main>
  );
}
