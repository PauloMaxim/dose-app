import type { AppLocale } from "./types";
import { useDose } from "./store";

const pt = {
  "nav.articles": "Artigos",
  "nav.home": "Home",
  "nav.profile": "Perfil",
  "settings.title": "Configurações",
  "settings.account": "Conta",
  "settings.plan": "Plano atual",
  "settings.free": "Free",
  "settings.upgrade": "Upgrade",
  "settings.photo": "Foto de perfil",
  "settings.photo.change": "Alterar",
  "settings.name": "Nome",
  "settings.name.hint": "Como te chamamos",
  "settings.username": "Username",
  "settings.username.hint": "Como aparece nos comentários",
  "settings.email": "Email",
  "settings.password": "Senha",
  "settings.prefs": "Preferências",
  "settings.theme": "Tema",
  "settings.theme.dark": "Escuro",
  "settings.theme.light": "Claro",
  "settings.sound": "Efeitos sonoros",
  "settings.lang": "Idioma",
  "settings.lang.pt": "Português",
  "settings.lang.en": "English",
  "settings.goal": "Meta diária",
  "settings.reminder": "Lembrete",
  "settings.about": "Sobre",
  "settings.help": "Ajuda",
  "settings.privacy": "Privacidade",
  "settings.terms": "Fontes e termos",
  "settings.version": "Versão",
  "settings.logout": "Sair",
  "settings.logout.hint":
    "A sessão encerra. Ofensiva, notas e visual ficam neste aparelho — entre de novo com o mesmo email.",
  "settings.logout.confirm": "Encerrar sessão",
  "settings.delete": "Limpar cache local",
  "settings.delete.hint":
    "Remove apenas o cache deste aparelho. Seus dados da conta permanecem no servidor.",
  "settings.delete.confirm": "Confirmar limpeza",
  "settings.cancel": "Cancelar",
  "settings.save": "Salvar",
  "settings.off": "Off",
  "settings.others": "Outros",
  "plans.kicker": "Dose+",
  "plans.title": "Dose+ por 7 dias, de graça",
  "plans.bubble": "Te aviso antes do teste acabar.",
  "plans.weekly": "Semanal",
  "plans.monthly": "Mensal",
  "plans.yearly": "Anual",
  "plans.week": "/semana",
  "plans.month": "/mês",
  "plans.installments": "12x de",
  "plans.save": "Economize R$ 36,12 no ano vs o mensal",
  "plans.best": "Melhor valor",
  "plans.cta": "Testar 7 dias grátis",
  "plans.skip": "Pular e seguir no Free",
  "plans.cancel": "7 dias grátis. Depois cobra o plano. Cancele quando quiser, sem multa.",
  "plans.why": "O que o Dose+ destrava",
  "plans.b1": "Dashboard: minutos, ofensiva e especialidade",
  "plans.b2": "Notas em Fato / Conduta / Cautela",
  "plans.b3": "Leituras e salvos sem teto (Free: 4 e 3)",
  "plans.b4": "Escudo de ofensiva e arquivo da especialidade",
  "plans.b5": "Armário premium: gala, halo e asas",
  "pay.title": "Pagamento",
  "pay.soon": "Cobrança só depois dos 7 dias grátis.",
  "pay.why": "Você leva",
  "pay.back": "Voltar",
  "pay.home": "Seguir no Dose",
  "login.back": "Voltar ao Dose",
};

const en: typeof pt = {
  "nav.articles": "Library",
  "nav.home": "Home",
  "nav.profile": "Profile",
  "settings.title": "Settings",
  "settings.account": "Account",
  "settings.plan": "Current plan",
  "settings.free": "Free",
  "settings.upgrade": "Upgrade",
  "settings.photo": "Profile photo",
  "settings.photo.change": "Change",
  "settings.name": "Name",
  "settings.name.hint": "How we address you",
  "settings.username": "Username",
  "settings.username.hint": "How you appear in comments",
  "settings.email": "Email",
  "settings.password": "Password",
  "settings.prefs": "Preferences",
  "settings.theme": "Theme",
  "settings.theme.dark": "Dark",
  "settings.theme.light": "Light",
  "settings.sound": "Sound effects",
  "settings.lang": "Language",
  "settings.lang.pt": "Português",
  "settings.lang.en": "English",
  "settings.goal": "Daily goal",
  "settings.reminder": "Reminder",
  "settings.about": "About",
  "settings.help": "Help",
  "settings.privacy": "Privacy",
  "settings.terms": "Sources and terms",
  "settings.version": "Version",
  "settings.logout": "Log out",
  "settings.logout.hint":
    "This ends the session. Streak, notes and looks stay on this device — sign back in with the same email.",
  "settings.logout.confirm": "End session",
  "settings.delete": "Clear local cache",
  "settings.delete.hint":
    "Removes only this device cache. Your account data remains on the server.",
  "settings.delete.confirm": "Confirm clearing",
  "settings.cancel": "Cancel",
  "settings.save": "Save",
  "settings.off": "Off",
  "settings.others": "Other",
  "plans.kicker": "Dose+",
  "plans.title": "Dose+ free for 7 days",
  "plans.bubble": "I'll remind you before the trial ends.",
  "plans.weekly": "Weekly",
  "plans.monthly": "Monthly",
  "plans.yearly": "Yearly",
  "plans.week": "/week",
  "plans.month": "/month",
  "plans.installments": "12×",
  "plans.save": "Save R$ 36.12 a year vs monthly",
  "plans.best": "Best value",
  "plans.cta": "Try 7 days free",
  "plans.skip": "Skip and stay on Free",
  "plans.cancel": "7 days free, then the plan. Cancel anytime, no fees.",
  "plans.why": "What Dose+ unlocks",
  "plans.b1": "Dashboard: minutes, streak and specialty",
  "plans.b2": "Notes as Fact / Action / Caution",
  "plans.b3": "No cap on reads or saves (Free: 4 and 3)",
  "plans.b4": "Streak shield and specialty archive",
  "plans.b5": "Premium wardrobe: gala, halo and wings",
  "pay.title": "Payment",
  "pay.soon": "You are only charged after 7 free days.",
  "pay.why": "You get",
  "pay.back": "Back",
  "pay.home": "Continue in Dose",
  "login.back": "Back to Dose",
};

const tables: Record<AppLocale, typeof pt> = { pt, en };

export type I18nKey = keyof typeof pt;

export function t(locale: AppLocale, key: I18nKey) {
  return tables[locale][key] ?? tables.pt[key];
}

export function useT() {
  const locale = useDose((s) => s.profile.locale) ?? "pt";
  return (key: I18nKey) => t(locale, key);
}

/** Locale normalization is deliberately separate from scientific-content language. */
export function toIntlLocale(locale: AppLocale): "pt-BR" | "en" {
  return locale === "en" ? "en" : "pt-BR";
}

export function formatDate(
  value: string | number | Date,
  locale: AppLocale = "pt",
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(new Date(value));
}

export function formatNumber(
  value: number,
  locale: AppLocale = "pt",
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}
