import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { Mascot, SlotGlyph, deriveMood, mascotName } from "@/components/mascot";
import {
  CLOTHES,
  DEFAULT_LOOK,
  HATS,
  SHOES,
  WARDROBE_SECTIONS,
  isUnlocked,
} from "@/lib/outfits";
import { isPremium } from "@/lib/premium";
import { selectCompletedCount, selectStreak, todayGoalMet, useDose } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ClothesId, HatId, MascotLook, ShoesId, WardrobeSlot } from "@/lib/types";

export const Route = createFileRoute("/_app/mascote")({
  component: MascotePage,
});

function MascotePage() {
  const profile = useDose((s) => s.profile);
  const logs = useDose((s) => s.logs);
  const progress = useDose((s) => s.progress);
  const setLook = useDose((s) => s.setLook);
  const finished = selectCompletedCount(progress);
  const streak = selectStreak(logs);
  const goalMet = todayGoalMet(logs);
  const mood = deriveMood({
    goalMetToday: goalMet,
    streak,
    hour: new Date().getHours(),
  });
  const name = mascotName();
  const look = profile.look ?? DEFAULT_LOOK;
  const premium = isPremium(profile.plan);
  const [preview, setPreview] = useState<Partial<MascotLook>>({});

  const displayLook: MascotLook = {
    clothes: preview.clothes ?? look.clothes,
    hat: preview.hat ?? look.hat,
    shoes: preview.shoes ?? look.shoes,
  };

  const previewItems = useMemo(() => {
    return WARDROBE_SECTIONS.flatMap((section) => {
      const id = preview[section.slot];
      if (!id || id === "none") return [];
      const item = section.items.find((i) => i.id === id);
      if (!item || isUnlocked(item.need, finished)) return [];
      return [{ ...item, slot: section.slot }];
    });
  }, [preview, finished]);

  function wear(slot: WardrobeSlot, id: string, open: boolean) {
    if (open) {
      setPreview((p) => {
        if (!(slot in p)) return p;
        const next = { ...p };
        delete next[slot];
        return next;
      });
      const current = look[slot];
      const nextId = current === id && id !== "none" ? "none" : id;
      if (slot === "clothes") setLook({ clothes: nextId as ClothesId });
      if (slot === "hat") setLook({ hat: nextId as HatId });
      if (slot === "shoes") setLook({ shoes: nextId as ShoesId });
      return;
    }
    setPreview((p) => {
      if (p[slot] === id) {
        const next = { ...p };
        delete next[slot];
        return next;
      }
      return { ...p, [slot]: id };
    });
  }

  const worn = [
    displayLook.clothes !== "none" && CLOTHES.find((c) => c.id === displayLook.clothes)?.name,
    displayLook.hat !== "none" && HATS.find((h) => h.id === displayLook.hat)?.name,
    displayLook.shoes !== "none" && SHOES.find((s) => s.id === displayLook.shoes)?.name,
  ].filter(Boolean);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-5 pb-10 pt-4">
      <header className="mb-4 flex items-center gap-2">
        <Link
          to="/"
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-full bg-card"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight">{name}</h1>
      </header>

      <div className="flex flex-col items-center rounded-2xl bg-card py-6" data-tour="tour-lumen">
        <Mascot
          look={displayLook}
          mood={mood}
          streak={streak}
          size={148}
          fed={goalMet}
        />
        <p className="mt-3 text-sm text-muted">
          {finished} artigo{finished === 1 ? "" : "s"} lidos
        </p>
        <p className="mt-1 px-4 text-center text-xs text-teal">
          {worn.length ? worn.join(" · ") : "Visual de fábrica"}
        </p>
        {previewItems.length > 0 ? (
          <ul className="mt-3 w-full space-y-1.5 px-4">
            {previewItems.map((item) => (
              <li
                key={`${item.slot}-${item.id}`}
                className="rounded-xl bg-elevated px-3 py-2 text-center"
              >
                <p className="text-xs font-semibold text-star">Prévia · {item.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Desbloqueia com {item.need} artigo{item.need === 1 ? "" : "s"}. Faltam{" "}
                  {item.need - finished}.
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 px-5 text-center text-[11px] text-subtle">
            Toque num bloqueado para ver como fica e quantos artigos faltam.
          </p>
        )}
      </div>

      {WARDROBE_SECTIONS.map((section, i) => (
        <section key={section.slot} className="mt-6" data-tour={i === 0 ? "tour-clothes" : undefined}>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
            {section.title}
          </h2>
          <ul className="grid grid-cols-3 gap-2">
            {section.items.map((item) => {
              const articleOpen = isUnlocked(item.need, finished);
              const open = articleOpen && (!item.premium || premium);
              const equipped = look[section.slot] === item.id && open;
              const previewing = preview[section.slot] === item.id && !open;
              const remaining = Math.max(0, item.need - finished);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => wear(section.slot, item.id, open)}
                    className={cn(
                      "flex min-h-[118px] w-full flex-col items-center justify-center rounded-2xl px-1.5 py-2.5",
                      equipped && "tab-gradient text-on-accent",
                      previewing && "bg-card ring-1 ring-star",
                      !equipped && !previewing && "bg-card",
                      !open && !previewing && "opacity-80",
                    )}
                    aria-label={
                      open
                        ? `${item.name}${equipped ? ", usando" : ""}`
                        : item.premium && articleOpen
                          ? `${item.name}, Dose+. Toque para prévia.`
                          : `${item.name}, bloqueado. Desbloqueia com ${item.need} artigos. Faltam ${remaining}. Toque para prévia.`
                    }
                  >
                    <SlotGlyph slot={section.slot} id={item.id} />
                    <p className="mt-1 line-clamp-2 text-center text-[10px] font-medium leading-tight">
                      {item.name}
                    </p>
                    {item.premium && (
                      <p className={cn("text-[9px] font-semibold", equipped ? "text-on-accent" : "text-star")}>
                        Premium
                      </p>
                    )}
                    {!open ? (
                      <p
                        className={cn(
                          "mt-1 flex items-center gap-0.5 text-[10px] tabular-nums",
                          previewing ? "text-star" : "text-muted",
                        )}
                      >
                        <Lock className="size-2.5" />
                        {item.premium && articleOpen ? "Dose+" : `${item.need} art. · ${remaining}`}
                      </p>
                    ) : equipped ? (
                      <p className="mt-1 text-[10px] font-semibold">usando</p>
                    ) : item.need > 0 ? (
                      <p className="mt-1 text-[10px] text-subtle">{item.need} art.</p>
                    ) : (
                      <p className="mt-1 text-[10px] text-subtle">livre</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
