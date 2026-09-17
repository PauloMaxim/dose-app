import type { PlanId } from "./types";

export const PLANS: Array<{
  id: Exclude<PlanId, "free">
  priceLabel: string
  cents: number
  period: "week" | "month" | "year"
}> = [
  { id: "weekly", priceLabel: "18,00", cents: 1800, period: "week" },
  { id: "yearly", priceLabel: "23,99", cents: 2399, period: "year" },
  { id: "monthly", priceLabel: "27,00", cents: 2700, period: "month" },
];

export function planName(id: PlanId, locale: "pt" | "en") {
  if (id === "weekly") return locale === "en" ? "Weekly" : "Semanal";
  if (id === "monthly") return locale === "en" ? "Monthly" : "Mensal";
  if (id === "yearly") return locale === "en" ? "Yearly" : "Anual";
  return "Free";
}
