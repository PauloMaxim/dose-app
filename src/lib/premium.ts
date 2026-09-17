import type { PlanId } from "./types";

/** Limites do Free. A edição do dia conta como leitura. */
export const FREE_READS_PER_DAY = 4;
export const FREE_SAVES = 3;

export function isPremium(plan: PlanId | undefined): boolean {
  return Boolean(plan && plan !== "free");
}

export function parsePlan(value: unknown): PlanId {
  if (value === "weekly" || value === "monthly" || value === "yearly") return value;
  return "free";
}
