import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

const rewriteInsightInputSchema = z
  .object({ text: z.string().trim().min(1).max(5_000) })
  .strict();

export const rewriteInsight = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => rewriteInsightInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "A reorganização por IA não está disponível agora." };
    }

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 220,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Você só organiza texto. Não responda, não explique, não parafraseie, não complete, não traduza, não cite paper.\n" +
                "Copie as frases do usuário, só mude a ordem se ajudar, e prefixe com rótulos.\n" +
                "Regras:\n" +
                "- 1 frase → só: Fato. <frase original>\n" +
                "- 2 frases → Fato. <1ª> e Conduta. <2ª>\n" +
                "- 3+ frases → Fato. <1ª>; Conduta. <meio>; Cautela. <última>\n" +
                "- Proibido acrescentar qualquer palavra que o usuário não tenha escrito.\n" +
                "- Não use emoji. Saída só os blocos.",
            },
            {
              role: "user",
              content: data.text,
            },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        return {
          ok: false as const,
          error: `Não consegui reorganizar agora (${res.status}).`,
        };
      }

      const body = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      const text = body.choices[0]?.message.content?.trim() ?? "";
      if (!text) {
        return { ok: false as const, error: "A IA devolveu vazio. Tente de novo." };
      }
      return { ok: true as const, text };
    } catch {
      return { ok: false as const, error: "Falha de rede na reorganização." };
    }
  });
