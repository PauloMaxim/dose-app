import { Check, Copy, ExternalLink, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/share";

export function ShareSheet({
  title,
  subtitle,
  sourceLabel,
  sourceUrl,
  onClose,
}: {
  title: string
  subtitle?: string
  sourceLabel?: string
  sourceUrl?: string
  onClose: () => void
}) {
  const payload = [title, subtitle, sourceLabel, sourceUrl].filter(Boolean).join("\n");
  const [copied, setCopied] = useState<"ok" | "select" | null>(null);
  const [canNative, setCanNative] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
    const el = ta.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  async function copy() {
    const el = ta.current;
    if (el) {
      el.focus();
      el.select();
    }
    const ok = el ? await copyText(payload, el) : await copyText(payload);
    if (ok) {
      setCopied("ok");
      window.setTimeout(() => setCopied(null), 2200);
      return;
    }
    el?.select();
    setCopied("select");
  }

  async function nativeShare() {
    try {
      await navigator.share({
        title,
        text: payload,
        url: sourceUrl,
      });
      onClose();
    } catch {
      void copy();
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(payload)}`;

  const node = (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/70">
      <button type="button" aria-label="Fechar" className="flex-1" onClick={onClose} />
      <div className="rounded-t-3xl bg-card px-5 pb-8 pt-4 shadow-[0_-12px_40px_rgb(0_0_0/0.45)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[17px] font-semibold">Compartilhar</p>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X className="size-5 text-muted" />
          </button>
        </div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-subtle">
          Texto pronto
        </label>
        <textarea
          ref={ta}
          readOnly
          value={payload}
          rows={5}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full resize-none rounded-2xl bg-elevated px-4 py-3 text-sm leading-relaxed text-fg outline-none"
        />
        {copied === "ok" && (
          <p className="mt-2 text-center text-xs text-teal">Copiado para a área de transferência.</p>
        )}
        {copied === "select" && (
          <p className="mt-2 text-center text-xs text-star">
            Texto selecionado — copie com Ctrl+C ou toque longo.
          </p>
        )}
        <div className="mt-4 space-y-2">
          <Button className="w-full" onClick={() => void copy()}>
            {copied === "ok" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "ok" ? "Copiado" : "Copiar texto e fonte"}
          </Button>
          {canNative && (
            <Button variant="secondary" className="w-full" onClick={() => void nativeShare()}>
              Compartilhar nativo
            </Button>
          )}
          <Button variant="secondary" className="w-full" asChild>
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </Button>
          {sourceUrl && (
            <Button variant="outline" className="w-full" asChild>
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Abrir {sourceLabel ?? "fonte"}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
