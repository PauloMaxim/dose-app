import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("manifest is installable and references existing, branded assets", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.name, "Dose");
  assert.equal(manifest.lang, "pt-BR");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons[0].src, "/favicon.svg");
});

test("service worker caches only an explicit public allowlist", async () => {
  const sw = await read("public/sw.js");
  assert.match(sw, /SAFE_ASSETS/);
  assert.match(sw, /request\.mode === "navigate"/);
  assert.doesNotMatch(sw, /\/api\/|entitlements|payments|token|Authorization/);
});

test("notification permission is only requested from explicit flows", async () => {
  const root = await read("src/routes/__root.tsx");
  const registration = await read("src/components/pwa-registration.tsx");
  assert.doesNotMatch(root, /requestPermission/);
  assert.doesNotMatch(registration, /requestPermission/);
  assert.doesNotMatch(await read("src/components/phone-frame.tsx"), /ReminderHost/);
});

test("push mutations derive ownership from authenticated server context", async () => {
  const domain = await read("src/server/domains/user-data.ts");
  assert.match(domain, /user_id: context\.userId/);
  assert.match(domain, /\.eq\("user_id", context\.userId\)/);
  assert.match(domain, /pushSubscriptionSchema\.parse/);
  assert.match(domain, /pushUnsubscribeSchema\.parse/);
});

test("browser bundle boundary contains no privileged server environment", async () => {
  const root = await read("src/routes/__root.tsx");
  const registration = await read("src/components/pwa-registration.tsx");
  assert.doesNotMatch(
    root + registration,
    /service.role|SUPABASE_SERVICE|STRIPE_SECRET|OPENAI_API/i,
  );
});
