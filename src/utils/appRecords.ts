import {
  getStoreValue,
  saveStore,
  setStoreValue,
} from "@/utils/store";
import type {
  DiagnosticSnapshot,
  DownloadItem,
  SearchSession,
} from "@/types/app";

const STORE_KEYS = {
  diagnostics: "diagnosticSnapshots",
  downloads: "downloadItems",
  sessions: "searchSessions",
} as const;

const MAX_SESSIONS = 50;
const MAX_DIAGNOSTICS = 50;

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export async function loadSearchSessions(): Promise<SearchSession[]> {
  const sessions = await getStoreValue<SearchSession[]>(STORE_KEYS.sessions);
  return toArray(sessions);
}

export async function saveSearchSessions(sessions: SearchSession[]): Promise<void> {
  await setStoreValue(STORE_KEYS.sessions, sessions.slice(0, MAX_SESSIONS));
  await saveStore();
}

export async function appendSearchSession(
  session: SearchSession,
): Promise<SearchSession[]> {
  const current = await loadSearchSessions();
  const next = [session, ...current].slice(0, MAX_SESSIONS);
  await saveSearchSessions(next);
  return next;
}

export async function updateSearchSessionOutputPath(
  sessionId: string,
  outputPath: string,
): Promise<SearchSession[]> {
  const current = await loadSearchSessions();
  const next = current.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          outputPath,
        }
      : session,
  );
  await saveSearchSessions(next);
  return next;
}

export async function loadDownloadItems(): Promise<DownloadItem[]> {
  const downloads = await getStoreValue<DownloadItem[]>(STORE_KEYS.downloads);
  return toArray(downloads);
}

export async function saveDownloadItems(downloads: DownloadItem[]): Promise<void> {
  await setStoreValue(STORE_KEYS.downloads, downloads);
  await saveStore();
}

export async function appendDownloadItem(item: DownloadItem): Promise<DownloadItem[]> {
  const current = await loadDownloadItems();
  const next = [item, ...current];
  await saveDownloadItems(next);
  return next;
}

export async function removeDownloadItem(itemId: string): Promise<DownloadItem[]> {
  const current = await loadDownloadItems();
  const next = current.filter((item) => item.id !== itemId);
  await saveDownloadItems(next);
  return next;
}

export async function loadDiagnosticSnapshots(): Promise<DiagnosticSnapshot[]> {
  const snapshots = await getStoreValue<DiagnosticSnapshot[]>(STORE_KEYS.diagnostics);
  return toArray(snapshots);
}

export async function appendDiagnosticSnapshot(
  snapshot: DiagnosticSnapshot,
): Promise<DiagnosticSnapshot[]> {
  const current = await loadDiagnosticSnapshots();
  const next = [snapshot, ...current].slice(0, MAX_DIAGNOSTICS);
  await setStoreValue(STORE_KEYS.diagnostics, next);
  await saveStore();
  return next;
}
