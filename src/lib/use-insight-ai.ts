import { useServerFn } from "@tanstack/react-start";
import { rewriteInsight } from "@/lib/ai";
import { isFaithfulRewrite, localOrganize, normalizeOrganized } from "@/lib/insight-format";

export function useInsightAi() {
  const rewrite = useServerFn(rewriteInsight);

  return async (
    text: string,
    _articleTitle?: string,
  ): Promise<{ text: string; usedAi: boolean; error?: string }> => {
    const raw = text.trim();
    const local = localOrganize(raw);
    try {
      const res = await rewrite({ data: { text: raw } });
      if (res.ok && res.text.trim() && isFaithfulRewrite(raw, res.text)) {
        return { text: normalizeOrganized(res.text.trim()), usedAi: true };
      }
      return { text: local, usedAi: false };
    } catch {
      return { text: local, usedAi: false };
    }
  };
}
