import { ARTICLES } from "./content";
import { useDose } from "./store";
import type { DayLog, Insight, ReadingProgress, SavedItem } from "./types";
import {
  createMyCollection,
  createMyNote,
  deleteMyNote,
  readMyContent,
  setMyLibraryEntry,
  updateMyNote,
  upsertMyReadingProgress,
} from "../server/domains/user-content";

type ContentSnapshot = Awaited<ReturnType<typeof readMyContent>>;
const LEGACY_BACKUP_KEY = "dose-legacy-content-v1";
const pendingProgress = new Map<string, ReturnType<typeof setTimeout>>();
const lastQueuedProgress = new Map<string, number>();

function backupUnownedLegacyContent(): void {
  if (typeof window === "undefined" || window.localStorage.getItem(LEGACY_BACKUP_KEY)) return;
  const state = useDose.getState();
  window.localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify({
    saved: state.saved,
    progress: state.progress,
    insights: state.insights,
    collections: state.collections,
    logs: state.logs,
    backedUpAt: new Date().toISOString(),
  }));
}

function dayLogsFromProgress(progress: Record<string, ReadingProgress>): DayLog[] {
  const byDate = new Map<string, DayLog>();
  for (const item of Object.values(progress)) {
    if (!item.completedAt) continue;
    const date = item.completedAt.slice(0, 10);
    const current = byDate.get(date) ?? { date, minutes: 0, articlesCompleted: [], goalMet: false };
    current.minutes += item.minutesRead;
    current.articlesCompleted.push(item.articleId);
    current.goalMet = true;
    byDate.set(date, current);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function applyRemoteContent(snapshot: ContentSnapshot): void {
  const saved: SavedItem[] = snapshot.saved.map((item) => ({
    articleId: item.articleKey,
    savedAt: item.createdAt,
    liked: item.liked,
    collectionIds: item.collectionIds,
  }));
  const progress = Object.fromEntries(snapshot.progress.map((item) => [item.articleKey, {
    articleId: item.articleKey,
    scrollPct: item.progressPercent,
    completed: Boolean(item.completedAt),
    completedAt: item.completedAt ?? undefined,
    minutesRead: item.minutesRead,
  } satisfies ReadingProgress]));
  const insights: Insight[] = snapshot.notes.map((note) => ({
    id: note.id,
    articleId: note.articleKey,
    text: note.body,
    createdAt: note.createdAt,
  }));
  useDose.setState({
    saved,
    progress,
    insights,
    collections: snapshot.collections.map((collection) => ({ id: collection.id, name: collection.name })),
    logs: dayLogsFromProgress(progress),
  });
}

export async function refreshMyContent(cacheOwnerKey?: string): Promise<ContentSnapshot> {
  backupUnownedLegacyContent();
  const snapshot = await readMyContent();
  applyRemoteContent(snapshot);
  if (cacheOwnerKey && typeof window !== "undefined") {
    window.localStorage.setItem(`dose-content-sync-v1:${cacheOwnerKey}`, new Date().toISOString());
  }
  return snapshot;
}

export async function persistLibraryEntry(articleKey: string, liked: boolean, collectionIds: string[]): Promise<void> {
  await setMyLibraryEntry({ data: { articleKey, liked, collectionIds } });
  await refreshMyContent();
}

export async function persistCollection(name: string): Promise<string> {
  const collection = await createMyCollection({ data: { name } });
  await refreshMyContent();
  return collection.id;
}

export async function persistNote(articleKey: string, body: string): Promise<void> {
  await createMyNote({ data: { articleKey, body } });
  await refreshMyContent();
}

export async function persistNoteUpdate(noteId: string, body: string): Promise<void> {
  await updateMyNote({ data: { noteId, body } });
  await refreshMyContent();
}

export async function persistNoteDelete(noteId: string): Promise<void> {
  await deleteMyNote({ data: { noteId } });
  await refreshMyContent();
}

async function sendProgress(articleKey: string, progressPercent: number, completed: boolean): Promise<void> {
  const article = ARTICLES.find((item) => item.id === articleKey);
  const result = await upsertMyReadingProgress({ data: {
    articleKey,
    progressPercent,
    completed,
    minutesRead: completed ? (article?.minutes ?? 0) : 0,
  } });
  useDose.setState((state) => ({
    progress: {
      ...state.progress,
      [articleKey]: {
        articleId: articleKey,
        scrollPct: result.progressPercent,
        completed: Boolean(result.completedAt),
        completedAt: result.completedAt ?? undefined,
        minutesRead: result.minutesRead,
      },
    },
  }));
}

export function queueProgress(articleKey: string, progressPercent: number): void {
  const last = lastQueuedProgress.get(articleKey) ?? 0;
  if (progressPercent < 99 && progressPercent - last < 5) return;
  lastQueuedProgress.set(articleKey, progressPercent);
  const previous = pendingProgress.get(articleKey);
  if (previous) clearTimeout(previous);
  pendingProgress.set(articleKey, setTimeout(() => {
    pendingProgress.delete(articleKey);
    void sendProgress(articleKey, progressPercent, false).catch(() => undefined);
  }, 1200));
}

export async function completeProgress(articleKey: string): Promise<void> {
  const previous = pendingProgress.get(articleKey);
  if (previous) clearTimeout(previous);
  pendingProgress.delete(articleKey);
  lastQueuedProgress.delete(articleKey);
  await sendProgress(articleKey, 100, true);
}
