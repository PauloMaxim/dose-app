import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";

const seed = {
  state: {
    profile: {
      name: "Marina",
      title: "Dra.",
      specialty: "Cardiologia",
      topics: ["Insuficiência cardíaca", "Obesidade e incretinas"],
      dailyGoalMin: 15,
      weeklyGoalMin: 90,
      mascot: "owl",
      outfit: "none",
      onboardingComplete: true,
      reminderHour: null,
    },
    progress: {},
    logs: [],
    insights: [],
    saved: [],
    collections: [{ id: "later", name: "Ler mais tarde" }],
    comments: [],
    ratings: {},
    openedSources: [],
    lastReminderDate: null,
  },
  version: 0,
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 844 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("CON", msg.text());
  });
  page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
  await page.addInitScript((data) => {
    localStorage.setItem("dose-app-v2", JSON.stringify(data));
  }, seed);

  const out = {};

  await page.goto(`${base}/artigo/summit`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  out.artigoTitle = await page.locator("h1").first().textContent();

  // Share
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await page.waitForTimeout(400);
  out.shareSheet = await page.getByText("Compartilhar", { exact: true }).count();
  out.shareTextarea = await page.locator("textarea").filter({ hasText: "SUMMIT" }).count();
  await page.getByRole("button", { name: /Copiar texto/ }).click();
  await page.waitForTimeout(400);
  out.copied = (await page.getByText(/Copiado/).count()) > 0;
  await page.getByRole("button", { name: "Fechar" }).first().click();
  await page.waitForTimeout(300);

  // Comment
  const composer = page.locator("form").filter({ hasText: "Publicar comentário" });
  await composer.locator("textarea").fill(
    "HR puxado por descompensação, não mortalidade. Titular SGLT2 antes da incretina neste fenótipo.",
  );
  await composer.getByRole("button", { name: "Publicar comentário" }).click();
  await page.waitForTimeout(600);
  out.publishedMsg = (await page.getByText("Publicado na comunidade.").count()) > 0;
  out.mine = (await page.getByText("Seu comentário").count()) > 0;
  out.commentText = (await page.getByText(/Titular SGLT2/).count()) > 0;

  // Insights search param should not 500
  await page.goto(`${base}/insights?novo=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  out.insightsError = (await page.getByText("Algo deu errado").count()) > 0;
  out.insightsComposer = (await page.getByText("Salvar e reorganizar com IA").count()) > 0;

  // Notes AI from artigos tab
  await page.goto(`${base}/artigos`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Notas" }).click();
  await page.waitForTimeout(300);
  const nova = page.getByRole("button", { name: "Nova nota" });
  if ((await nova.count()) > 0) await nova.first().click();
  await page.waitForTimeout(300);
  out.notasComposer = (await page.getByText("Salvar e reorganizar com IA").count()) > 0;
  const noteTa = page.locator("textarea").filter({
    hasText: "",
  }).last();
  await page.locator("textarea").last().fill(
    "O HR foi puxado por descompensação, não por morte CV. Na prática eu titularia SGLT2 antes de discutir tirzepatida neste fenótipo. Fora de HFpEF com obesidade o SUMMIT não autoriza nada.",
  );
  await page.getByRole("button", { name: "Salvar e reorganizar com IA" }).click();
  out.aiBusy = await page.getByText("Reorganizando com IA…").count();
  await page.waitForTimeout(20000);
  const body = await page.locator("body").innerText();
  out.hasFato = /Fato/i.test(body);
  out.hasConduta = /Conduta/i.test(body);
  out.hasCautela = /Cautela/i.test(body);
  out.insightsErrorAfter = (await page.getByText("Algo deu errado").count()) > 0;
  out.bodySnippet = body.slice(0, 1500);

  console.log(JSON.stringify(out, null, 2));
  await page.screenshot({ path: "/workspace/screenshots/qa-three-bugs.png", fullPage: true });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
