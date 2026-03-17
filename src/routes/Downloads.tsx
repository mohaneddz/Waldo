import { For, Show, createSignal, onMount } from "solid-js";
import FolderOpen from "lucide-solid/icons/folder-open";
import FileSearch from "lucide-solid/icons/file-search";
import Trash2 from "lucide-solid/icons/trash-2";

import Button from "@/components/Buttton";
import {
  loadDownloadItems,
  removeDownloadItem,
  saveDownloadItems,
} from "@/utils/appRecords";
import type { DownloadItem } from "@/types/app";
import { exists } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

export default function DownloadsRoute() {
  const [items, setItems] = createSignal<DownloadItem[]>([]);

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    const downloads = await loadDownloadItems();
    const resolved = await Promise.all(
      downloads.map(async (item) => ({
        ...item,
        exists: await exists(item.savedPath),
      })),
    );

    setItems(resolved);
    await saveDownloadItems(resolved);
  }

  async function removeItem(id: string) {
    const next = await removeDownloadItem(id);
    setItems(next);
  }

  return (
    <section class="page downloads-page">
      <header class="page-header">
        <h1>Downloads</h1>
        <Button variant="ghost" onClick={refresh}>Refresh</Button>
      </header>

      <div class="downloads-list vintage-paper">
        <Show when={items().length > 0} fallback={<p>No downloaded results yet.</p>}>
          <For each={items()}>
            {(item) => (
              <article class="download-item">
                <div>
                  <h3>{item.savedPath.split(/[/\\]/).at(-1)}</h3>
                  <p>{new Date(item.createdAt).toLocaleString()}</p>
                  <small class={item.exists ? "ok-text" : "error-text"}>
                    {item.exists ? "File exists" : "File missing"}
                  </small>
                </div>

                <div class="history-actions">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void openPath(item.savedPath);
                    }}
                    disabled={!item.exists}
                  >
                    <FileSearch size={16} /> Open File
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void revealItemInDir(item.savedPath);
                    }}
                    disabled={!item.exists}
                  >
                    <FolderOpen size={16} /> Show Folder
                  </Button>
                  <Button variant="danger" onClick={() => void removeItem(item.id)}>
                    <Trash2 size={16} /> Remove
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
