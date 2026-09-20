import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  AtSign,
  Bell,
  ChevronRight,
  CircleHelp,
  Clock,
  FileText,
  Languages,
  Lock,
  LogOut,
  Mail,
  Moon,
  Shield,
  Sparkles,
  User,
  Volume2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AvatarEdit } from "@/components/avatar";
import { formatClock, TimePicker } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { changePassword, reauthenticatePassword, signOut, updateEmail } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/i18n";
import { planName } from "@/lib/plans";
import { playSound } from "@/lib/sound";
import { useDose } from "@/lib/store";
import type { AppLocale, ThemeMode, TitlePrefix } from "@/lib/types";
import { cn, slugUsername } from "@/lib/utils";
import { updateMyProfile } from "@/server/domains/user-data";
import { deleteMyAccount } from "@/server/domains/account";

export const Route = createFileRoute("/config")({
  component: ConfigPage,
});

const GOAL_PRESETS = [5, 10, 15, 20];
const REMIND_PRESETS = [7, 12, 18, 21];

function ConfigPage() {
  const t = useT();
  const navigate = useNavigate();
  const profile = useDose((s) => s.profile);
  const update = useDose((s) => s.updateProfile);
  const setReminderHour = useDose((s) => s.setReminderHour);
  const resetDemo = useDose((s) => s.resetDemo);
  const { user } = useCurrentUserState();
  const [open, setOpen] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [userDraft, setUserDraft] = useState(profile.username || slugUsername(profile.name));
  const [emailDraft, setEmailDraft] = useState(user?.primaryEmail ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [customGoal, setCustomGoal] = useState(
    GOAL_PRESETS.includes(profile.dailyGoalMin) ? "" : String(profile.dailyGoalMin),
  );
  const [pickHour, setPickHour] = useState(profile.reminderHour ?? 12);
  const [pickMin, setPickMin] = useState(profile.reminderMinute || 0);
  const [customRemind, setCustomRemind] = useState(
    profile.reminderHour != null && !REMIND_PRESETS.includes(profile.reminderHour),
  );

  async function applyReminder(hour: number | null, minute = 0) {
    setReminderHour(hour, minute);
    if (hour == null) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
  }

  const setStep = useDose((s) => s.setOnboardingStep);

  async function logoutKeep() {
    setLeaving(true);
    playSound("tap");
    setStep(0);
    try {
      await signOut("/onboarding");
    } catch {
      /* session may already be gone */
    }
    void navigate({ to: "/onboarding" });
  }

  async function wipe() {
    setLeaving(true);
    setFormMsg("");
    if (!deletePassword || deletePhrase !== "EXCLUIR") {
      setFormMsg("Informe sua senha e digite EXCLUIR para confirmar.");
      setLeaving(false);
      return;
    }
    const verified = await reauthenticatePassword(deletePassword);
    if (verified.error) {
      setFormMsg("A senha atual não confere. A conta não foi excluída.");
      setLeaving(false);
      return;
    }
    try {
      await deleteMyAccount();
    } catch {
      setFormMsg("Não foi possível excluir sua conta agora. Tente novamente.");
      setLeaving(false);
      return;
    }
    resetDemo();
    await useDose.persist.clearStorage();
    resetDemo();
    try {
      await signOut("/onboarding");
    } catch {
      void navigate({ to: "/onboarding" });
    }
  }

  const clock =
    profile.reminderHour == null
      ? t("settings.off")
      : formatClock(profile.reminderHour, profile.reminderMinute || 0);

  const planLabel =
    profile.plan === "free" ? t("settings.free") : planName(profile.plan, profile.locale);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
      <header
        className="flex items-center gap-3 px-4 py-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate({ to: "/perfil" })}
          className="flex size-10 items-center justify-center"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-[22px] font-semibold tracking-tight">{t("settings.title")}</h1>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-12">
        <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
          {t("settings.account")}
        </p>
        <div className="rounded-2xl bg-card">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Sparkles className="size-5 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{t("settings.plan")}</p>
              <p className="text-sm font-semibold">{planLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                playSound("tap");
                void navigate({ to: "/planos" });
              }}
              className="h-8 rounded-full bg-elevated px-3 text-xs font-semibold"
            >
              {t("settings.upgrade")}
            </button>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <AvatarEdit
              name={profile.name}
              src={profile.avatar}
              onPick={(src) => update({ avatar: src })}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t("settings.photo")}</p>
              <p className="text-xs text-muted">{t("settings.photo.change")}</p>
            </div>
            <ChevronRight className="size-4 text-subtle" />
          </div>
          <EditRow
            icon={<User className="size-5 text-muted" />}
            title={t("settings.name")}
            value={`${profile.title} ${profile.name}`}
            open={open === "name"}
            onToggle={() => setOpen(open === "name" ? null : "name")}
          >
            <div className="mb-2 flex gap-2">
              {(["Dra.", "Dr."] as const).map((x) => (
                <Chip
                  key={x}
                  on={profile.title === x}
                  onClick={() => update({ title: x as TitlePrefix })}
                >
                  {x}
                </Chip>
              ))}
            </div>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
            />
            <p className="mt-1 text-[11px] text-subtle">{t("settings.name.hint")}</p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                const next = nameDraft.trim();
                if (next.length < 2) return;
                update({ name: next });
                if (user) void updateMyProfile({ data: { displayName: next } });
                if (!profile.username) update({ username: slugUsername(next) });
                setOpen(null);
              }}
            >
              {t("settings.save")}
            </Button>
          </EditRow>
          <EditRow
            icon={<AtSign className="size-5 text-muted" />}
            title={t("settings.username")}
            value={profile.username ? `@${profile.username}` : "—"}
            open={open === "user"}
            onToggle={() => setOpen(open === "user" ? null : "user")}
          >
            <input
              value={userDraft}
              onChange={(e) =>
                setUserDraft(e.target.value.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 20))
              }
              className="h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
            />
            <p className="mt-1 text-[11px] text-subtle">{t("settings.username.hint")}</p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                const u = userDraft.toLowerCase();
                if (u.length < 3) return;
                update({ username: u });
                setOpen(null);
              }}
            >
              {t("settings.save")}
            </Button>
          </EditRow>
          <EditRow
            icon={<Mail className="size-5 text-muted" />}
            title={t("settings.email")}
            value={user?.primaryEmail ?? "—"}
            open={open === "email"}
            onToggle={() => setOpen(open === "email" ? null : "email")}
          >
            <input
              type="email"
              autoComplete="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              className="h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
            />
            <label htmlFor="email-current-password" className="mt-2 block text-xs text-muted">
              Confirme sua senha atual
            </label>
            <input
              id="email-current-password"
              type="password"
              autoComplete="current-password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                void (async () => {
                  setFormMsg("");
                  const next = emailDraft.trim();
                  if (!next.includes("@")) return;
                  const verified = await reauthenticatePassword(emailPassword);
                  if (verified.error) {
                    setFormMsg("A senha atual não confere. O e-mail não foi alterado.");
                    return;
                  }
                  const { error } = await updateEmail(next);
                  setFormMsg(
                    error
                      ? "Não foi possível solicitar a alteração do e-mail."
                      : "Alteração solicitada. Confirme o novo endereço antes que ele seja atualizado.",
                  );
                })();
              }}
            >
              {t("settings.save")}
            </Button>
            {formMsg && open === "email" && (
              <p className="mt-1 text-[11px] text-muted">{formMsg}</p>
            )}
          </EditRow>
          <EditRow
            icon={<Lock className="size-5 text-muted" />}
            title={t("settings.password")}
            value="••••••••"
            open={open === "pass"}
            onToggle={() => setOpen(open === "pass" ? null : "pass")}
          >
            <input
              type="password"
              placeholder="Senha atual"
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
              className="h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
            />
            <input
              type="password"
              placeholder="Nova senha (mín. 8)"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="mt-2 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
            />
            <input
              type="password"
              aria-label="Confirmar nova senha"
              autoComplete="new-password"
              placeholder="Confirmar nova senha"
              value={newPassConfirm}
              onChange={(e) => setNewPassConfirm(e.target.value)}
              className="mt-2 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                void (async () => {
                  setFormMsg("");
                  if (newPass !== newPassConfirm) {
                    setFormMsg("As senhas não coincidem.");
                    return;
                  }
                  if (newPass.length < 8) {
                    setFormMsg("A nova senha precisa de 8 caracteres.");
                    return;
                  }
                  const { error } = await changePassword(curPass, newPass);
                  setFormMsg(
                    error
                      ? "Não foi possível alterar a senha. Confira a senha atual."
                      : "Senha atualizada com segurança.",
                  );
                })();
              }}
            >
              {t("settings.save")}
            </Button>
            {formMsg && open === "pass" && <p className="mt-1 text-[11px] text-muted">{formMsg}</p>}
          </EditRow>
        </div>

        <p className="mb-2 mt-7 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
          {t("settings.prefs")}
        </p>
        <div className="rounded-2xl bg-card">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Moon className="size-5 text-muted" />
            <span className="flex-1 text-sm font-medium">{t("settings.theme")}</span>
            <div className="flex gap-1 rounded-full bg-elevated p-1">
              {(["dark", "light"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    playSound("tap");
                    update({ theme: mode });
                  }}
                  className={cn(
                    "h-7 rounded-full px-3 text-[11px] font-semibold",
                    profile.theme === mode ? "tab-gradient text-on-accent" : "text-muted",
                  )}
                >
                  {mode === "dark" ? t("settings.theme.dark") : t("settings.theme.light")}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Volume2 className="size-5 text-muted" />
            <span className="flex-1 text-sm font-medium">{t("settings.sound")}</span>
            <Toggle
              on={profile.soundOn}
              onClick={() => {
                const next = !profile.soundOn;
                update({ soundOn: next });
                if (next) playSound("tap");
              }}
            />
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Languages className="size-5 text-muted" />
            <span className="flex-1 text-sm font-medium">{t("settings.lang")}</span>
            <div className="flex gap-1 rounded-full bg-elevated p-1">
              {(["pt", "en"] as AppLocale[]).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    update({ locale: loc });
                    if (user)
                      void updateMyProfile({ data: { locale: loc === "en" ? "en" : "pt-BR" } });
                  }}
                  className={cn(
                    "h-7 rounded-full px-3 text-[11px] font-semibold",
                    profile.locale === loc ? "tab-gradient text-on-accent" : "text-muted",
                  )}
                >
                  {loc === "pt" ? "PT" : "EN"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={() => setOpen(open === "goal" ? null : "goal")}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <Clock className="size-5 text-muted" />
            <span className="flex-1 text-sm font-medium">{t("settings.goal")}</span>
            <span className="text-sm text-muted">{profile.dailyGoalMin} min</span>
            <ChevronRight className="size-4 text-subtle" />
          </button>
          {open === "goal" && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {GOAL_PRESETS.map((g) => (
                  <Chip
                    key={g}
                    on={profile.dailyGoalMin === g && customGoal === ""}
                    onClick={() => {
                      setCustomGoal("");
                      update({ dailyGoalMin: g, weeklyGoalMin: g * 6 });
                    }}
                  >
                    {g} min
                  </Chip>
                ))}
                <Chip
                  on={customGoal !== "" || !GOAL_PRESETS.includes(profile.dailyGoalMin)}
                  onClick={() => setCustomGoal(String(profile.dailyGoalMin))}
                >
                  {t("settings.others")}
                </Chip>
              </div>
              {(customGoal !== "" || !GOAL_PRESETS.includes(profile.dailyGoalMin)) && (
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={customGoal || profile.dailyGoalMin}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setCustomGoal(e.target.value);
                    if (Number.isFinite(n) && n >= 5 && n <= 60) {
                      update({ dailyGoalMin: Math.round(n), weeklyGoalMin: Math.round(n) * 6 });
                    }
                  }}
                  className="mt-3 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
                />
              )}
            </div>
          )}
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={() => setOpen(open === "remind" ? null : "remind")}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <Bell className="size-5 text-muted" />
            <span className="flex-1 text-sm font-medium">{t("settings.reminder")}</span>
            <span className="text-sm tabular-nums text-muted">{clock}</span>
            <ChevronRight className="size-4 text-subtle" />
          </button>
          {open === "remind" && (
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                <Chip
                  on={profile.reminderHour == null}
                  onClick={() => {
                    setCustomRemind(false);
                    void applyReminder(null);
                  }}
                >
                  {t("settings.off")}
                </Chip>
                {REMIND_PRESETS.map((h) => (
                  <Chip
                    key={h}
                    on={
                      !customRemind &&
                      profile.reminderHour === h &&
                      (profile.reminderMinute || 0) === 0
                    }
                    onClick={() => {
                      setCustomRemind(false);
                      setPickHour(h);
                      setPickMin(0);
                      void applyReminder(h, 0);
                    }}
                  >
                    {formatClock(h, 0)}
                  </Chip>
                ))}
                <Chip
                  on={customRemind}
                  onClick={() => {
                    setCustomRemind(true);
                    const h = profile.reminderHour ?? 12;
                    const m = profile.reminderMinute || 0;
                    setPickHour(h);
                    setPickMin(m);
                    void applyReminder(h, m);
                  }}
                >
                  {t("settings.others")}
                </Chip>
              </div>
              {customRemind && (
                <div className="mt-4">
                  <TimePicker
                    hour={pickHour}
                    minute={pickMin}
                    onChange={(h, m) => {
                      setPickHour(h);
                      setPickMin(m);
                      void applyReminder(h, m);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mb-2 mt-7 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
          {t("settings.about")}
        </p>
        <div className="rounded-2xl bg-card">
          <LinkRow
            icon={<CircleHelp className="size-5 text-muted" />}
            title={t("settings.help")}
            onClick={() => setOpen(open === "help" ? null : "help")}
          />
          {open === "help" && (
            <Copy>Uma edição por dia, 10–15 minutos. Lê, a Lúmen come, a ofensiva segue.</Copy>
          )}
          <Link
            to="/privacidade"
            search={{ from: "config" } as never}
            className="flex min-h-12 items-center gap-3 px-4 py-3.5"
          >
            <Shield className="size-5 text-muted" />
            <span className="flex-1 text-sm font-medium">Política de Privacidade</span>
            <ChevronRight className="size-4 text-subtle" />
          </Link>
          <Link
            to="/termos"
            search={{ from: "config" } as never}
            className="flex min-h-12 items-center gap-3 px-4 py-3.5"
          >
            <FileText className="size-5 text-muted" />
            <span className="flex-1 text-sm font-medium">Termos de Uso</span>
            <ChevronRight className="size-4 text-subtle" />
          </Link>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm font-medium">{t("settings.version")}</span>
            <span className="text-sm text-muted">1.0.0</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-card">
          {confirmOut ? (
            <div className="px-4 py-4">
              <p className="text-sm text-muted">{t("settings.logout.hint")}</p>
              <Button
                size="lg"
                className="mt-3 w-full"
                disabled={leaving}
                onClick={() => void logoutKeep()}
              >
                <LogOut className="size-4" />
                {t("settings.logout.confirm")}
              </Button>
              <button
                type="button"
                className="mt-2 h-11 w-full text-sm text-muted"
                onClick={() => setConfirmOut(false)}
              >
                {t("settings.cancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmDel(false);
                setConfirmOut(true);
              }}
              className="flex h-14 w-full items-center justify-center gap-2 text-sm font-medium"
            >
              <LogOut className="size-4" />
              {t("settings.logout")}
            </button>
          )}
        </div>

        <div className="mt-3">
          {confirmDel ? (
            <div className="rounded-2xl border border-danger/40 px-4 py-4">
              <p className="text-sm text-muted">{t("settings.delete.hint")}</p>
              <label htmlFor="delete-password" className="mt-3 block text-sm font-medium">
                Senha atual
              </label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
              />
              <label htmlFor="delete-phrase" className="mt-3 block text-sm font-medium">
                Digite EXCLUIR
              </label>
              <input
                id="delete-phrase"
                autoComplete="off"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                className="mt-1 h-11 w-full rounded-full bg-elevated px-4 text-sm outline-none"
              />
              {formMsg && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {formMsg}
                </p>
              )}
              <Button
                size="lg"
                className="mt-3 w-full bg-danger text-on-accent"
                disabled={leaving}
                onClick={() => void wipe()}
              >
                {t("settings.delete.confirm")}
              </Button>
              <button
                type="button"
                className="mt-2 h-11 w-full text-sm text-muted"
                onClick={() => setConfirmDel(false)}
              >
                {t("settings.cancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmOut(false);
                setConfirmDel(true);
              }}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-danger/45 text-sm font-semibold text-danger"
            >
              {t("settings.delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditRow({
  icon,
  title,
  value,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted">{value}</p>
        </div>
        <ChevronRight
          className={cn("size-4 text-subtle transition-transform", open && "rotate-90")}
        />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </>
  );
}

function LinkRow({
  icon,
  title,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
    >
      {icon}
      <span className="flex-1 text-sm font-medium">{title}</span>
      <ChevronRight className="size-4 text-subtle" />
    </button>
  );
}

function Copy({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-3 text-[13px] leading-relaxed text-muted">{children}</p>;
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-3 text-xs font-medium",
        on ? "tab-gradient text-on-accent" : "bg-elevated text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "relative h-8 w-[52px] shrink-0 overflow-hidden rounded-full p-1 transition-colors",
        on ? "bg-teal" : "bg-faint",
      )}
    >
      <span
        className={cn(
          "block size-6 rounded-full bg-white shadow-md transition-transform duration-200",
          on ? "translate-x-[20px]" : "translate-x-0",
        )}
      />
    </button>
  );
}
