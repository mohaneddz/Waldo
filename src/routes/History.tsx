import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Play from "lucide-solid/icons/play";
import Search from "lucide-solid/icons/search";
import FolderOpen from "lucide-solid/icons/folder-open";

import Button from "@/components/Buttton";
import { loadSearchSessions } from "@/utils/appRecords";
import { setSearchSettings, setSelectedImagePath } from "@/state/searchState";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { SearchSession } from "@/types/app";

export default function HistoryRoute() {
  const navigate = useNavigate();
  const [sessions, setSessions] = createSignal<SearchSession[]>([]);
  const [outcomeFilter, setOutcomeFilter] = createSignal<"all" | "found" | "not_found" | "error">("all");
  const [sortOrder, setSortOrder] = createSignal<"newest" | "oldest">("newest");

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    const entries = await loadSearchSessions();
    setSessions(entries);
  }

  const filtered = createMemo(() => {
    const entries = sessions().filter((session) =>
      outcomeFilter() === "all" ? true : session.outcome === outcomeFilter(),
    );

    return [...entries].sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return sortOrder() === "newest" ? bTime - aTime : aTime - bTime;
    });
  });

  function handleOutcomeFilterChange(value: string) {
    if (value === "all" || value === "found" || value === "not_found" || value === "error") {
      setOutcomeFilter(value);
    }
  }

  function handleSortOrderChange(value: string) {
    if (value === "newest" || value === "oldest") {
      setSortOrder(value);
    }
  }

  function loadSession(session: SearchSession, startNow: boolean) {
    setSelectedImagePath(session.sourcePath);
    setSearchSettings(session.settings);
    navigate(startNow ? "/search/processing" : "/search/new");
  }

  return (
    <section class="page history-page">
      <header class="page-header">
        <h1>Search History</h1>
        <div class="inline-controls">
          <select
            class="v-input"
            value={outcomeFilter()}
            onChange={(event) => handleOutcomeFilterChange(event.currentTarget.value)}
          >
            <option value="all">All outcomes</option>
            <option value="found">Found</option>
            <option value="not_found">Not found</option>
            <option value="error">Errors</option>
          </select>
          <select
            class="v-input"
            value={sortOrder()}
            onChange={(event) => handleSortOrderChange(event.currentTarget.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </header>

      <div class="history-list vintage-paper">
        <Show when={filtered().length > 0} fallback={<p>No saved sessions yet.</p>}>
          <For each={filtered()}>
            {(session) => (
              <article class="history-item">
                <div>
                  <h3>{session.sourceName}</h3>
                  <p>
                    {new Date(session.timestamp).toLocaleString()} · {session.outcome.replace("_", " ")} ·
                    {" "}{session.detectionsCount} detections
                  </p>
                  <small>
                    Threshold {session.settings.confidenceThreshold} · Timeout {session.settings.timeout}s · Device {session.settings.inferenceDevice}
                  </small>
                </div>

                <div class="history-actions">
                  <Button variant="ghost" onClick={() => loadSession(session, false)}>
                    <Search size={16} /> Reopen
                  </Button>
                  <Button variant="secondary" onClick={() => loadSession(session, true)}>
                    <Play size={16} /> Re-run
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (session.outputPath) {
                        void openPath(session.outputPath);
                      }
                    }}
                    disabled={!session.outputPath}
                  >
                    Open Result
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (session.outputPath) {
                        void revealItemInDir(session.outputPath);
                      }
                    }}
                    disabled={!session.outputPath}
                  >
                    <FolderOpen size={16} /> Open Folder
                  </Button>
                </div>
              </article>
            )}
          </For>
        </Show>
      </div>
    </section>
  );
}
