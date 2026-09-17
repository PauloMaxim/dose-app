/** Split a raw clinical note into Fato / Conduta / Cautela using only the user's words. */

export function localOrganize(raw: string, _articleTitle = ""): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return text;
  if (looksOrganized(text)) return normalizeOrganized(text);

  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return text;
  if (sentences.length === 1) return "Fato. " + sentences[0];
  if (sentences.length === 2) {
    return ["Fato. " + sentences[0], "Conduta. " + sentences[1]].join("\n\n");
  }
  const fato = sentences[0]!;
  const cautela = sentences[sentences.length - 1]!;
  const conduta = sentences.slice(1, -1).join(" ");
  return ["Fato. " + fato, "Conduta. " + conduta, "Cautela. " + cautela].join("\n\n");
}

export function normalizeOrganized(text: string): string {
  return text
    .replace(/\s*[;•]\s*(Fato|Conduta|Cautela)\s*[.:–-]\s*/gi, "\n\n$1. ")
    .replace(/(Fato|Conduta|Cautela)\s*[.:–-]\s*/gi, (full, label, offset) =>
      offset === 0 ? `${label}. ` : `\n\n${label}. `,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function looksOrganized(text: string): boolean {
  const t = text.toLowerCase();
  return /\bfato\b/.test(t) && (/\bconduta\b/.test(t) || /\bcautela\b/.test(t));
}

export function parseInsightBlocks(text: string): Array<{ label: string; body: string }> | null {
  const re = /(?:^|\n)\s*(Fato|Conduta|Cautela)\s*[.:–-]\s*/gi;
  const parts: Array<{ label: string; body: string }> = [];
  let match: RegExpExecArray | null;
  const indices: Array<{ label: string; start: number; bodyStart: number }> = [];
  while ((match = re.exec(text))) {
    indices.push({
      label: match[1]!,
      start: match.index,
      bodyStart: match.index + match[0].length,
    });
  }
  if (indices.length < 1) return null;
  for (let i = 0; i < indices.length; i++) {
    const cur = indices[i]!;
    const end = indices[i + 1]?.start ?? text.length;
    const body = text.slice(cur.bodyStart, end).trim();
    if (body) parts.push({ label: cur.label, body });
  }
  return parts.length >= 1 ? parts : null;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2);
}

/** True when every content word in `result` already appears in `original`. */
export function isFaithfulRewrite(original: string, result: string): boolean {
  const orig = new Set(tokens(original));
  const skip = new Set(["fato", "conduta", "cautela"]);
  const extra = tokens(result).filter((t) => !skip.has(t) && !orig.has(t));
  return extra.length === 0 && tokens(result).some((t) => !skip.has(t));
}
