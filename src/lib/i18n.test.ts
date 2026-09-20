import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate, formatNumber, t, toIntlLocale } from "./i18n";

test("pt uses deterministic pt-BR formatting", () => {
  assert.equal(toIntlLocale("pt"), "pt-BR");
  assert.match(formatNumber(1234.5, "pt"), /1\.234,5/);
  assert.match(formatDate("2026-09-20T12:00:00Z", "pt", { timeZone: "UTC" }), /2026/);
});

test("catalog returns translations for supported locales", () => {
  assert.equal(t("pt", "settings.save"), "Salvar");
  assert.equal(t("en", "settings.save"), "Save");
});
