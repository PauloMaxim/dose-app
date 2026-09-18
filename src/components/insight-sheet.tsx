import { Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PaywallBanner } from "@/components/paywall-gate";
import { getArticle } from "@/lib/content";
import { isPremium } from "@/lib/premium";
import { useDose } from "@/lib/store";
import { useInsightAi } from "@/lib/use-insight-ai";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { persistNote } from "@/lib/user-content";

type RecCtor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
};

function speechCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor
    webkitSpeechRecognition?: RecCtor
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function InsightSheet({
  articleId,
  onClose,
}: {
  articleId: string
  onClose: () => void
}) {
  const addInsight = useDose((s) => s.addInsight);
  const premium = isPremium(useDose((s) => s.profile.plan));
  const organize = useInsightAi();
  const user = useCurrentUser();
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micErr, setMicErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const Ctor = speechCtor();

  useEffect(() => {
    return () => recRef.current?.stop();
  }, []);

  function toggleMic() {
    if (!Ctor) {
      setMicErr("O microfone não está disponível neste navegador.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    setMicErr(null);
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const piece = last?.[0]?.transcript ?? "";
      if (piece) {
        setDraft((prev) => {
          const base = prev.trim();
          return base ? `${base} ${piece}` : piece;
        });
      }
    };
    rec.onerror = () => {
      setListening(false);
      setMicErr("Não deu para ouvir. Pode digitar.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function save() {
    const text = draft.trim();
    if (text.length < 4) return;
    if (authEnabled && !user) {
      setErr("Sua sessão expirou. Entre novamente para salvar a nota.");
      return;
    }
    setBusy(true);
    setErr(null);
    recRef.current?.stop();
    try {
      const title = getArticle(articleId)?.title ?? "";
      const res = await organize(text, title);
      if (res.error) setErr(res.error);
      if (user) await persistNote(articleId, res.text);
      else if (!authEnabled) addInsight(articleId, res.text);
      else throw new Error("session expired");
      onClose();
    } catch {
      setErr("Não consegui salvar.");
    } finally {
      setBusy(false);
    }
  }

  const node = (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/70">
      <button type="button" aria-label="Fechar" className="flex-1" onClick={onClose} />
      <div className="rounded-t-3xl bg-card px-5 pb-8 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[17px] font-semibold">Insight</p>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="size-5 text-muted" />
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-subtle">
          Só reorganiza o que você escreveu — não é um segundo resumo.
        </p>
        {!premium ? (
          <PaywallBanner
            title="Notas são Dose+"
            line="Fato, conduta e cautela a partir do que você ditou."
          />
        ) : (
        <>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          placeholder="Ex.: HR puxado por descompensação, não mortalidade. Titular SGLT2 antes de discutir incretina neste fenótipo."
          className="w-full resize-none rounded-2xl bg-elevated px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-subtle"
        />
        {(micErr || err) && (
          <p className="mt-2 text-xs text-danger">{micErr ?? err}</p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant={listening ? "gradient" : "outline"}
            className="flex-1"
            onClick={toggleMic}
            disabled={busy}
          >
            {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
            {listening ? "Parar" : "Falar"}
          </Button>
          <Button
            type="button"
            className="flex-[1.6]"
            disabled={draft.trim().length < 4 || busy}
            onClick={() => void save()}
          >
            {busy ? "Reorganizando…" : "Reorganizar e salvar"}
          </Button>
        </div>
        </>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
