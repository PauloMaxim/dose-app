/**
 * Estado local do Dose.
 *
 * Fluxo: onboarding → Dose+ (planos) → home.
 * Logout (signOut) NÃO chama resetDemo — ofensiva, look e notas ficam no aparelho.
 * Free: edição do dia, 4 leituras, 3 salvos, armário básico.
 * Dose+: dashboard, notas, sem teto, visuais premium.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ARTICLES } from "./content";
import { DEFAULT_LOOK, migrateLook } from "./outfits";
import { FREE_READS_PER_DAY, FREE_SAVES, isPremium } from "./premium";
import type {
  Collection,
  DayLog,
  Insight,
  MascotLook,
  Profile,
  PublicComment,
  ReadingProgress,
  SavedItem,
  Specialty,
  TitlePrefix,
} from "./types";
import { todayIso, uid } from "./utils";

const LATER_ID = "later";

export const DEFAULT_COLLECTIONS: Collection[] = [{ id: LATER_ID, name: "Ler mais tarde" }];

const DEFAULT_PROFILE: Profile = {
  name: "Marina",
  username: "marina",
  avatar: null,
  title: "Dra.",
  specialty: "Cardiologia",
  topics: [
    "Insuficiência cardíaca",
    "Obesidade e incretinas",
    "Fibrilação atrial",
    "Prevenção cardiovascular",
  ],
  dailyGoalMin: 15,
  weeklyGoalMin: 90,
  look: DEFAULT_LOOK,
  onboardingComplete: false,
  tutorialComplete: false,
  reminderHour: null,
  reminderMinute: 0,
  theme: "dark",
  soundOn: true,
  locale: "pt",
  plan: "free",
  planScreenSeen: false,
};

interface DoseState {
  hydrated: boolean;
  profile: Profile;
  progress: Record<string, ReadingProgress>;
  logs: DayLog[];
  insights: Insight[];
  saved: SavedItem[];
  collections: Collection[];
  comments: PublicComment[];
  ratings: Record<string, number>;
  openedSources: string[];
  lastReminderDate: string | null;
  onboardingStep: number;
  onboardingDraftReady: boolean;
  setHydrated: () => void;
  saveOnboardingDraft: (partial: Partial<Profile>) => void;
  applyRemoteProfile: (
    partial: Pick<Profile, "name" | "locale" | "onboardingComplete"> &
      Partial<Pick<Profile, "specialty" | "topics">>,
  ) => void;
  clearPrivateSessionCache: () => void;
  updateProfile: (partial: Partial<Profile>) => void;
  setSpecialty: (s: Specialty) => void;
  setTitle: (t: TitlePrefix) => void;
  setLook: (partial: Partial<MascotLook>) => void;
  setOnboardingStep: (step: number) => void;
  completeTutorial: () => void;
  toggleTopic: (t: string) => void;
  setReminderHour: (hour: number | null, minute?: number) => void;
  markReminderFired: (date: string) => void;
  recordScroll: (articleId: string, pct: number) => void;
  completeArticle: (articleId: string) => void;
  toggleLike: (articleId: string) => void;
  saveToCollections: (articleId: string, collectionIds: string[]) => boolean;
  unsave: (articleId: string) => void;
  addCollection: (name: string) => string;
  addInsight: (articleId: string, text: string) => void;
  updateInsight: (id: string, text: string) => void;
  deleteInsight: (id: string) => void;
  addComment: (articleId: string, text: string, rating: number) => void;
  setRating: (articleId: string, rating: number) => void;
  markSourceOpened: (articleId: string) => void;
  resetDemo: () => void;
}

function upsertToday(logs: DayLog[], mut: (log: DayLog) => void): DayLog[] {
  const date = todayIso();
  const existing = logs.find((l) => l.date === date);
  if (existing) {
    const next = { ...existing };
    mut(next);
    return logs.map((l) => (l.date === date ? next : l));
  }
  const created: DayLog = {
    date,
    minutes: 0,
    articlesCompleted: [],
    goalMet: false,
  };
  mut(created);
  return [...logs, created];
}

function applyGoalFlag(log: DayLog, dailyGoal: number): void {
  log.goalMet = log.minutes >= dailyGoal || log.articlesCompleted.length > 0;
}

function emptySave(articleId: string, collectionIds: string[], liked = false): SavedItem {
  return {
    articleId,
    savedAt: new Date().toISOString(),
    liked,
    collectionIds,
  };
}

export const useDose = create<DoseState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      profile: DEFAULT_PROFILE,
      progress: {},
      logs: [],
      insights: [],
      saved: [],
      collections: DEFAULT_COLLECTIONS,
      comments: [],
      ratings: {},
      openedSources: [],
      lastReminderDate: null,
      onboardingStep: 0,
      onboardingDraftReady: false,
      setHydrated: () => set({ hydrated: true }),
      saveOnboardingDraft: (partial) =>
        set((s) => ({
          onboardingStep: 0,
          onboardingDraftReady: true,
          // A finished local flow is still only a draft. Completion can only
          // be applied from the authenticated remote profile below.
          profile: { ...s.profile, ...partial, plan: s.profile.plan, onboardingComplete: false },
        })),
      applyRemoteProfile: (partial) =>
        set((s) => ({
          profile: { ...s.profile, ...partial, plan: "free" },
          onboardingDraftReady: partial.onboardingComplete ? false : s.onboardingDraftReady,
        })),
      clearPrivateSessionCache: () =>
        set((state) => ({
          // Preserve a genuine anonymous draft until its first reconciliation.
          // Otherwise remove every identity-bound profile projection immediately.
          profile: state.onboardingDraftReady
            ? state.profile
            : {
                ...state.profile,
                name: "Colega",
                username: "",
                specialty: DEFAULT_PROFILE.specialty,
                topics: [],
                onboardingComplete: false,
              },
          progress: {},
          logs: [],
          insights: [],
          saved: [],
          collections: DEFAULT_COLLECTIONS,
          comments: [],
          ratings: {},
          openedSources: [],
          lastReminderDate: null,
        })),
      updateProfile: (partial) =>
        // Local callers may update presentation preferences, never billing authority.
        set((s) => ({ profile: { ...s.profile, ...partial, plan: s.profile.plan } })),
      setSpecialty: (specialty) => set((s) => ({ profile: { ...s.profile, specialty } })),
      setTitle: (title) => set((s) => ({ profile: { ...s.profile, title } })),
      setLook: (partial) =>
        set((s) => ({
          profile: {
            ...s.profile,
            look: { ...DEFAULT_LOOK, ...s.profile.look, ...partial },
          },
        })),
      setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
      completeTutorial: () =>
        set((s) => ({
          profile: { ...s.profile, tutorialComplete: true },
        })),
      toggleTopic: (t) =>
        set((s) => {
          const has = s.profile.topics.includes(t);
          return {
            profile: {
              ...s.profile,
              topics: has ? s.profile.topics.filter((x) => x !== t) : [...s.profile.topics, t],
            },
          };
        }),
      setReminderHour: (hour, minute = 0) =>
        set((s) => ({
          profile: {
            ...s.profile,
            reminderHour: hour,
            reminderMinute: hour == null ? 0 : minute,
          },
        })),
      markReminderFired: (date) => set({ lastReminderDate: date }),
      recordScroll: (articleId, pct) =>
        set((s) => {
          const prev = s.progress[articleId];
          if (prev?.completed) return s;
          const clamped = Math.min(99, Math.max(0, pct));
          return {
            progress: {
              ...s.progress,
              [articleId]: {
                articleId,
                scrollPct: Math.max(prev?.scrollPct ?? 0, clamped),
                completed: false,
                completedAt: prev?.completedAt,
                minutesRead: prev?.minutesRead ?? 0,
              },
            },
          };
        }),
      completeArticle: (articleId) => {
        set((s) => {
          if (s.progress[articleId]?.completed) return s;
          if (!isPremium(s.profile.plan)) {
            const todayCount = selectTodayLog(s.logs)?.articlesCompleted.length ?? 0;
            if (todayCount >= FREE_READS_PER_DAY) return s;
          }
          const art = ARTICLES.find((a) => a.id === articleId);
          const prev = s.progress[articleId] ?? {
            articleId,
            scrollPct: 0,
            completed: false,
            minutesRead: 0,
          };
          const remaining = Math.max(0, (art?.minutes ?? 0) - prev.minutesRead);
          const logs = upsertToday(s.logs, (log) => {
            log.minutes += remaining;
            if (!log.articlesCompleted.includes(articleId)) {
              log.articlesCompleted = [...log.articlesCompleted, articleId];
            }
            applyGoalFlag(log, s.profile.dailyGoalMin);
          });
          return {
            progress: {
              ...s.progress,
              [articleId]: {
                ...prev,
                scrollPct: 100,
                completed: true,
                completedAt: new Date().toISOString(),
                minutesRead: prev.minutesRead + remaining,
              },
            },
            logs,
          };
        });
      },
      toggleLike: (articleId) =>
        set((s) => {
          const exists = s.saved.find((x) => x.articleId === articleId);
          if (!exists) {
            return {
              saved: [...s.saved, emptySave(articleId, [LATER_ID], true)],
            };
          }
          const nextLiked = !exists.liked;
          if (!nextLiked && exists.collectionIds.length === 0) {
            return { saved: s.saved.filter((x) => x.articleId !== articleId) };
          }
          return {
            saved: s.saved.map((x) => (x.articleId === articleId ? { ...x, liked: nextLiked } : x)),
          };
        }),
      saveToCollections: (articleId, collectionIds) => {
        const s = get();
        const ids = collectionIds.length ? collectionIds : [LATER_ID];
        const exists = s.saved.find((x) => x.articleId === articleId);
        const already = Boolean(exists && exists.collectionIds.length > 0);
        if (!already && !isPremium(s.profile.plan)) {
          const count = s.saved.filter((x) => x.collectionIds.length > 0).length;
          if (count >= FREE_SAVES) return false;
        }
        set((cur) => {
          const found = cur.saved.find((x) => x.articleId === articleId);
          if (found) {
            return {
              saved: cur.saved.map((x) =>
                x.articleId === articleId ? { ...x, collectionIds: ids } : x,
              ),
            };
          }
          return { saved: [...cur.saved, emptySave(articleId, ids)] };
        });
        return true;
      },
      unsave: (articleId) =>
        set((s) => ({
          saved: s.saved
            .map((x) => (x.articleId === articleId ? { ...x, collectionIds: [] } : x))
            .filter((x) => x.liked || x.collectionIds.length > 0),
        })),
      addCollection: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return "";
        const dup = get().collections.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (dup) return dup.id;
        const id = uid();
        set((s) => ({
          collections: [...s.collections, { id, name: trimmed }],
        }));
        return id;
      },
      addInsight: (articleId, text) =>
        set((s) => ({
          insights: [
            {
              id: uid(),
              articleId,
              text,
              createdAt: new Date().toISOString(),
            },
            ...s.insights,
          ],
        })),
      updateInsight: (id, text) =>
        set((s) => ({
          insights: s.insights.map((i) => (i.id === id ? { ...i, text } : i)),
        })),
      deleteInsight: (id) => set((s) => ({ insights: s.insights.filter((i) => i.id !== id) })),
      addComment: (articleId, text, rating) =>
        set((s) => {
          const comment: PublicComment = {
            id: uid(),
            articleId,
            author: s.profile.name,
            username: s.profile.username,
            titlePrefix: s.profile.title,
            specialty: s.profile.specialty,
            text,
            rating,
            createdAt: new Date().toISOString(),
            mine: true,
          };
          return {
            comments: [comment, ...s.comments],
            ratings: { ...s.ratings, [articleId]: rating },
          };
        }),
      setRating: (articleId, rating) =>
        set((s) => ({ ratings: { ...s.ratings, [articleId]: rating } })),
      markSourceOpened: (articleId) =>
        set((s) =>
          s.openedSources.includes(articleId)
            ? s
            : { openedSources: [...s.openedSources, articleId] },
        ),
      resetDemo: () =>
        set({
          profile: DEFAULT_PROFILE,
          progress: {},
          logs: [],
          insights: [],
          saved: [],
          collections: DEFAULT_COLLECTIONS,
          comments: [],
          ratings: {},
          openedSources: [],
          lastReminderDate: null,
          onboardingStep: 0,
          onboardingDraftReady: false,
        }),
    }),
    {
      name: "dose-app-v2",
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DoseState>;
        return {
          ...current,
          ...p,
          profile: {
            ...current.profile,
            ...p.profile,
            look: migrateLook(
              p.profile as { look?: Partial<MascotLook>; outfit?: string } | undefined,
            ),
            tutorialComplete: Boolean(p.profile?.tutorialComplete),
            reminderMinute: p.profile?.reminderMinute ?? 0,
            username: p.profile?.username ?? "",
            avatar: p.profile?.avatar ?? null,
            theme: p.profile?.theme === "light" ? "light" : "dark",
            soundOn: p.profile?.soundOn !== false,
            locale: p.profile?.locale === "en" ? "en" : "pt",
            // Billing state is never restored from browser storage.
            plan: "free",
            planScreenSeen: Boolean(p.profile?.planScreenSeen),
          },
          comments: p.comments ?? [],
          ratings: p.ratings ?? {},
          // Legacy onboarding flags are never upgraded into a fresh draft.
          onboardingDraftReady: p.onboardingDraftReady === true,
        };
      },
      partialize: (s) => ({
        profile: { ...s.profile, plan: "free" as const },
        progress: s.progress,
        logs: s.logs,
        insights: s.insights,
        saved: s.saved,
        collections: s.collections,
        comments: s.comments,
        ratings: s.ratings,
        openedSources: s.openedSources,
        lastReminderDate: s.lastReminderDate,
        onboardingStep: s.onboardingStep,
        onboardingDraftReady: s.onboardingDraftReady,
      }),
    },
  ),
);

export function selectTodayLog(logs: DayLog[]): DayLog | undefined {
  const t = todayIso();
  return logs.find((l) => l.date === t);
}

export function selectWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return todayIso(d);
  });
}

export function selectStreak(logs: DayLog[]): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let cursor = todayIso();
  const today = byDate.get(cursor);
  if (!today?.goalMet) {
    cursor = addDaysSafe(cursor, -1);
  }
  let n = 0;
  while (byDate.get(cursor)?.goalMet) {
    n += 1;
    cursor = addDaysSafe(cursor, -1);
  }
  return n;
}

function addDaysSafe(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return todayIso(dt);
}

export function selectWeekMinutes(logs: DayLog[]): number {
  const week = new Set(selectWeekDates());
  return logs.filter((l) => week.has(l.date)).reduce((s, l) => s + l.minutes, 0);
}

export function selectCompletedCount(progress: Record<string, ReadingProgress>): number {
  return Object.values(progress).filter((p) => p.completed).length;
}

export function todayGoalMet(logs: DayLog[]): boolean {
  return Boolean(selectTodayLog(logs)?.goalMet);
}

export function selectTodayReads(logs: DayLog[]): number {
  return selectTodayLog(logs)?.articlesCompleted.length ?? 0;
}

export function canStartRead(plan: Profile["plan"], logs: DayLog[], alreadyOpen: boolean): boolean {
  if (isPremium(plan) || alreadyOpen) return true;
  return selectTodayReads(logs) < FREE_READS_PER_DAY;
}

export function selectSavedCount(saved: SavedItem[]): number {
  return saved.filter((x) => x.collectionIds.length > 0).length;
}

export function prioritizeArticleIds(specialty: Specialty, topics: string[]): string[] {
  const scored = ARTICLES.map((a) => {
    let score = 0;
    if (a.specialty === specialty) score += 5;
    const blob = `${a.title} ${a.subtitle} ${a.synopsis}`.toLowerCase();
    for (const t of topics) {
      if (blob.includes(t.toLowerCase().slice(0, 8))) score += 2;
    }
    return { id: a.id, score };
  });
  return scored.sort((a, b) => b.score - a.score).map((x) => x.id);
}

export function isSaved(item: SavedItem | undefined): boolean {
  return Boolean(item && item.collectionIds.length > 0);
}
