import { chromium } from "playwright";

const progress = Object.fromEntries(
  Array.from({ length: 16 }, (_, i) => [
    `a${i}`,
    {
      articleId: `a${i}`,
      scrollPct: 100,
      completed: true,
      minutesRead: 5,
    },
  ]),
);

const state = {
  profile: {
    name: "Marina",
    title: "Dra.",
    specialty: "Cardiologia",
    topics: ["Insuficiência cardíaca"],
    dailyGoalMin: 15,
    weeklyGoalMin: 90,
    mascot: "owl",
    look: { clothes: "none", hat: "none", shoes: "none" },
    onboardingComplete: true,
    reminderHour: null,
  },
  progress,
  logs: [],
  insights: [],
  saved: [],
  collections: [{ id: "later", name: "Ler mais tarde" }],
  comments: [],
  ratings: {},
  openedSources: [],
  lastReminderDate: null,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript((payload) => {
  localStorage.setItem("dose-app-v2", JSON.stringify({ state: payload, version: 0 }));
}, state);

await page.goto("http://127.0.0.1:8080/mascote", { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const shell = await page.evaluate(() => {
  const el = document.querySelector(".phone-shell");
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    position: cs.position,
    top: cs.top,
    height: cs.height,
    vv: getComputedStyle(document.documentElement).getPropertyValue("--vv-height").trim(),
  };
});

async function tapName(name) {
  await page.getByRole("button", { name }).first().click();
  await page.waitForTimeout(150);
}

await tapName("Jaleco");
await tapName("Gorro");
await tapName("Tênis");

const combo = await page.locator("text=Jaleco · Gorro · Tênis").count();
await page.screenshot({ path: "/workspace/screenshots/wardrobe-combo.png" });

await page.goto("http://127.0.0.1:8080/artigos", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Notas" }).click();
await page.waitForTimeout(200);
await page.getByText("Nova nota", { exact: true }).first().click();
const note =
  "HR puxado por descompensação, não mortalidade. Titularia SGLT2 antes da incretina. SUMMIT não autoriza fora de HFpEF com obesidade.";
await page.locator("textarea").fill(note);
await page.getByRole("button", { name: /Reorganizar e salvar/ }).click();
await page.waitForTimeout(8000);

const body = await page.locator("main").innerText();
const invented = /hazard ratio|desfecho composto|redefine a leitura/i.test(body);
const kept = /HR puxado|Titularia SGLT2|SUMMIT não autoriza/i.test(body);
const labeled = /Fato/i.test(body);

await page.screenshot({ path: "/workspace/screenshots/note-reorg.png" });

console.log(
  JSON.stringify(
    {
      shell,
      combo,
      invented,
      kept,
      labeled,
      snippet: body.slice(0, 700),
    },
    null,
    2,
  ),
);

await browser.close();
