import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { PaywallBanner } from "@/components/paywall-gate";
import { Button } from "@/components/ui/button";
import { FREE_SAVES, isPremium } from "@/lib/premium";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { isSaved, selectSavedCount, useDose } from "@/lib/store";
import { persistCollection, persistLibraryEntry } from "@/lib/user-content";
import { cn } from "@/lib/utils";

export function SaveSheet({
  articleId,
  onClose,
}: {
  articleId: string
  onClose: () => void
}) {
  const collections = useDose((s) => s.collections);
  const saved = useDose((s) => s.saved.find((x) => x.articleId === articleId));
  const specialty = useDose((s) => s.profile.specialty);
  const plan = useDose((s) => s.profile.plan);
  const savedCount = useDose((s) => selectSavedCount(s.saved));
  const saveToCollections = useDose((s) => s.saveToCollections);
  const unsave = useDose((s) => s.unsave);
  const addCollection = useDose((s) => s.addCollection);
  const user = useCurrentUser();

  const [picked, setPicked] = useState<string[]>(
    saved?.collectionIds.length ? saved.collectionIds : ["later"],
  );
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = useMemo(() => {
    const names = new Set(collections.map((c) => c.name.toLowerCase()));
    return [specialty].filter((n) => !names.has(n.toLowerCase()));
  }, [collections, specialty]);

  function toggle(id: string) {
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  async function create(name: string) {
    setError(null);
    if (authEnabled && !user) {
      setError("Sua sessão expirou. Entre novamente para criar a pasta.");
      return;
    }
    let id: string;
    try {
      id = user ? await persistCollection(name) : addCollection(name);
    } catch {
      setError("Não foi possível criar a pasta.");
      return;
    }
    if (!id) return;
    setPicked((cur) => (cur.includes(id) ? cur : [...cur, id]));
    setDraft("");
    setCreating(false);
  }

  const already = isSaved(saved);
  const blocked = !already && !isPremium(plan) && savedCount >= FREE_SAVES;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-bg/70">
      <button
        type="button"
        aria-label="Fechar"
        className="flex-1"
        onClick={onClose}
      />
      <div className="rounded-t-3xl bg-card px-5 pb-8 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[17px] font-semibold">Salvar em</p>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="size-5 text-muted" />
          </button>
        </div>
        <ul className="space-y-1.5">
          {collections.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex h-12 w-full items-center justify-between rounded-2xl px-4 text-left text-sm",
                    on ? "bg-elevated text-fg" : "bg-card-2 text-muted",
                  )}
                >
                  <span>{c.name}</span>
                  {on && <Check className="size-4 text-teal" />}
                </button>
              </li>
            );
          })}
        </ul>
        {presets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((name) => (
              <button
                key={name}
                type="button"
              onClick={() => void create(name)}
                className="h-9 rounded-full bg-card-2 px-3 text-xs font-medium text-muted"
              >
                + {name}
              </button>
            ))}
          </div>
        )}
        {creating ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) void create(draft);
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Cardiologia: RCP"
              className="h-11 flex-1 rounded-full bg-card-2 px-4 text-sm outline-none"
            />
            <Button type="submit" size="sm" disabled={!draft.trim()}>
              Criar
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-3 inline-flex h-11 items-center gap-2 text-sm font-medium text-teal"
          >
            <Plus className="size-4" />
            Nova pasta
          </button>
        )}
        {blocked ? (
          <div className="mt-2">
            <PaywallBanner
              title={`Free guarda ${FREE_SAVES} artigos`}
              line="Dose+ tira o teto dos salvos."
            />
          </div>
        ) : (
        <div className="mt-5 flex gap-2">
          {already && (
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                if (authEnabled && !user) {
                  setError("Sua sessão expirou. Entre novamente.");
                  return;
                }
                setBusy(true);
                const action = user
                  ? persistLibraryEntry(articleId, Boolean(saved?.liked), [])
                  : Promise.resolve(unsave(articleId));
                void action.then(onClose).catch(() => setError("Não foi possível remover o artigo.")).finally(() => setBusy(false));
              }}
            >
              Remover
            </Button>
          )}
          <Button
            className="flex-[1.4]"
            disabled={busy}
            onClick={() => {
              if (authEnabled && !user) {
                setError("Sua sessão expirou. Entre novamente.");
                return;
              }
              setBusy(true);
              const action = user
                ? persistLibraryEntry(articleId, Boolean(saved?.liked), picked)
                : Promise.resolve(saveToCollections(articleId, picked));
              void action.then(onClose).catch(() => setError("Não foi possível salvar o artigo.")).finally(() => setBusy(false));
            }}
          >
            Salvar
          </Button>
        </div>
        )}
        {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
      </div>
    </div>
  );
}
