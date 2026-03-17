import { createSignal, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";
import Upload from "lucide-solid/icons/upload";
import Search from "lucide-solid/icons/search";
import HistoryIcon from "lucide-solid/icons/history";
import FolderDown from "lucide-solid/icons/folder-down";
import Stethoscope from "lucide-solid/icons/stethoscope";

import Button from "@/components/Buttton";
import { setSelectedImagePath } from "@/state/searchState";
import { loadSearchSessions } from "@/utils/appRecords";

function getDroppedPath(event: DragEvent): string {
  const fileList = event.dataTransfer?.files;
  if (!fileList || fileList.length === 0) {
    return "";
  }

  const first = fileList[0] as File & { path?: string };
  return first.path ?? "";
}

export default function HomeRoute() {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [hasHistory, setHasHistory] = createSignal(false);

  onMount(() => {
    void (async () => {
      const sessions = await loadSearchSessions();
      setHasHistory(sessions.length > 0);
    })();
  });

  async function selectFromDialog() {
    const file = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "webp"] }],
    });

    if (!file || Array.isArray(file)) {
      return;
    }

    setSelectedImagePath(file);
    navigate("/search/new");
  }

  function trySampleImage() {
    setSelectedImagePath("/samples/sample-crowd.png");
    navigate("/search/new");
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragOver(false);

    const path = getDroppedPath(event);
    if (!path) {
      return;
    }

    setSelectedImagePath(path);
    navigate("/search/new");
  }

  return (
    <section class="page home-page">
      <div class="vintage-hero">
        <h1 class="hero-title">Where&apos;s Waldo Finder</h1>
        <p class="hero-subtitle">Upload a crowded image and let the detective work begin.</p>

        <div class="hero-actions">
          <Button variant="danger" class="hero-btn" onClick={selectFromDialog}>
            Open Image
          </Button>
          <Button variant="secondary" class="hero-btn" onClick={trySampleImage}>
            Try Sample Image
          </Button>
        </div>

        <div
          class={`drop-zone ${isDragOver() ? "active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload size={28} />
          <p>Drop an image here or browse your files</p>
          <small>JPG, PNG, BMP, WEBP - up to 20MB</small>
        </div>
      </div>

      <aside class="quick-links note-paper">
        <h2>How it works</h2>
        <ol>
          <li>Open or drop an image</li>
          <li>Adjust search settings</li>
          <li>Run search and review detections</li>
          <li>Save and export your result</li>
        </ol>

        <div class="quick-grid">
          <Button variant="ghost" class="quick-link" onClick={() => navigate("/search/new") }>
            <Search size={16} /> New Search
          </Button>
          <Button
            variant="ghost"
            class="quick-link"
            onClick={() => navigate("/history")}
            disabled={!hasHistory()}
          >
            <HistoryIcon size={16} /> Resume Last Search
          </Button>
          <Button variant="ghost" class="quick-link" onClick={() => navigate("/downloads")}>
            <FolderDown size={16} /> View Downloads
          </Button>
          <Button variant="ghost" class="quick-link" onClick={() => navigate("/diagnostics")}>
            <Stethoscope size={16} /> Diagnostics
          </Button>
        </div>

        <div class="tip-badge">
          <img src="/vintage/tip-badge.png" alt="Tip badge" />
          <p>Tip: high-resolution crowded scenes improve detection quality.</p>
        </div>
      </aside>
    </section>
  );
}
