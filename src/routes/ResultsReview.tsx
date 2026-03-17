import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import Download from "lucide-solid/icons/download";
import FolderOpen from "lucide-solid/icons/folder-open";
import Search from "lucide-solid/icons/search";
import Crosshair from "lucide-solid/icons/crosshair";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import ChevronRight from "lucide-solid/icons/chevron-right";

import Button from "@/components/Buttton";
import Image from "@/components/Image";
import { getRuntimeResult, setRuntimeResult } from "@/state/searchState";
import {
  appendDownloadItem,
  updateSearchSessionOutputPath,
} from "@/utils/appRecords";
import { createObjectUrlFromPath, loadImageFromPath } from "@/utils/image";
import { saveInferenceResult } from "@/services/inference";
import { loadAppSettings } from "@/utils/settings";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { Detection } from "@/services/inference";

const PAGE_SIZE = 25;

export default function ResultsReviewRoute() {
  const navigate = useNavigate();
  const runtimeResult = getRuntimeResult();

  const [tab, setTab] = createSignal<"overlay" | "original" | "crop" | "metadata">("overlay");
  const [previewSrc, setPreviewSrc] = createSignal("");
  const [cropSrc, setCropSrc] = createSignal("");
  const [overlayEnabled, setOverlayEnabled] = createSignal(true);
  const [overlayLimit, setOverlayLimit] = createSignal(25);
  const [overlayMinConfidence, setOverlayMinConfidence] = createSignal(0.2);
  const [metadataQuery, setMetadataQuery] = createSignal("");
  const [metadataSort, setMetadataSort] = createSignal<"confidence-desc" | "confidence-asc" | "class-asc">("confidence-desc");
  const [metadataPage, setMetadataPage] = createSignal(1);
  const [selectedDetectionId, setSelectedDetectionId] = createSignal<number | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [toast, setToast] = createSignal("");

  const sortedDetections = createMemo(() => {
    const detections = runtimeResult()?.detections ?? [];
    const query = metadataQuery().trim().toLowerCase();

    const filtered = detections.filter((item) => {
      if (!query) return true;
      const label = item.class.toLowerCase();
      const conf = (item.confidence * 100).toFixed(2);
      return label.includes(query) || conf.includes(query);
    });

    const sorted = [...filtered];
    if (metadataSort() === "confidence-desc") {
      sorted.sort((a, b) => b.confidence - a.confidence);
    } else if (metadataSort() === "confidence-asc") {
      sorted.sort((a, b) => a.confidence - b.confidence);
    } else {
      sorted.sort((a, b) => a.class.localeCompare(b.class));
    }

    return sorted;
  });

  const pageCount = createMemo(() => Math.max(1, Math.ceil(sortedDetections().length / PAGE_SIZE)));

  const pagedDetections = createMemo(() => {
    const page = Math.min(metadataPage(), pageCount());
    const start = (page - 1) * PAGE_SIZE;
    return sortedDetections().slice(start, start + PAGE_SIZE);
  });

  const selectedDetection = createMemo(() => {
    const all = sortedDetections();
    const idx = selectedDetectionId();
    if (idx !== null && idx >= 0 && idx < all.length) {
      return all[idx];
    }

    return all.length > 0 ? all[0] : null;
  });

  const overlayDetections = createMemo(() => {
    if (!overlayEnabled()) {
      return [];
    }

    const threshold = overlayMinConfidence();
    const max = Math.max(1, overlayLimit());

    return [...(runtimeResult()?.detections ?? [])]
      .filter((item) => item.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, max);
  });

  onMount(() => {
    void (async () => {
      if (!runtimeResult() || runtimeResult()!.outcome !== "found") {
        navigate("/results/not-found");
        return;
      }

      const source = await createObjectUrlFromPath(runtimeResult()!.sourcePath);
      setPreviewSrc(source);
    })();
  });

  createEffect(() => {
    metadataPage(Math.min(metadataPage(), pageCount()));
  });

  createEffect(() => {
    const result = runtimeResult();
    const detection = selectedDetection();

    if (!result || !detection) {
      setCropSrc("");
      return;
    }

    void buildCropImage(result.sourcePath, detection);
  });

  onCleanup(() => {
    const preview = previewSrc();
    const crop = cropSrc();

    if (preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    if (crop.startsWith("blob:")) {
      URL.revokeObjectURL(crop);
    }
  });

  async function buildCropImage(sourcePath: string, detection: Detection) {
    const previous = untrack(cropSrc);
    if (previous.startsWith("blob:")) {
      URL.revokeObjectURL(previous);
    }

    const { image, objectUrl } = await loadImageFromPath(sourcePath);

    const [x1, y1, x2, y2] = detection.bbox;
    const width = Math.max(1, Math.floor(x2 - x1));
    const height = Math.max(1, Math.floor(y2 - y1));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      if (objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, x1, y1, width, height, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) {
      setCropSrc(URL.createObjectURL(blob));
    }

    if (objectUrl.startsWith("blob:")) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function downloadResult() {
    const result = runtimeResult();
    if (!result) {
      return;
    }

    setBusy(true);
    try {
      const appSettings = await loadAppSettings();
      const savedPath = await saveInferenceResult(
        result.sourcePath,
        result.detections,
        result.settings.saveLocation || appSettings.saveLocation,
      );

      await updateSearchSessionOutputPath(result.sessionId, savedPath);
      await appendDownloadItem({
        id: crypto.randomUUID(),
        sessionId: result.sessionId,
        savedPath,
        createdAt: new Date().toISOString(),
        exists: true,
      });

      setRuntimeResult({ ...result, outputPath: savedPath });
      setToast(`Saved to ${savedPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save result.";
      setToast(message);
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(""), 2600);
    }
  }

  async function openSavedFile() {
    const outputPath = runtimeResult()?.outputPath;
    if (!outputPath) {
      setToast("No saved output yet. Download first.");
      return;
    }

    await openPath(outputPath);
  }

  async function openSavedFolder() {
    const outputPath = runtimeResult()?.outputPath;
    if (!outputPath) {
      setToast("No saved output yet. Download first.");
      return;
    }

    await revealItemInDir(outputPath);
  }

  return (
    <section class="page result-page">
      <header class="page-header">
        <h1>Review Result</h1>
        {toast() ? <p class="status-inline">{toast()}</p> : null}
      </header>

      <div class="result-layout">
        <div class="result-main vintage-paper">
          <div class="result-tabs">
            <Button variant={tab() === "overlay" ? "secondary" : "ghost"} onClick={() => setTab("overlay")}>Overlay</Button>
            <Button variant={tab() === "original" ? "secondary" : "ghost"} onClick={() => setTab("original")}>Original</Button>
            <Button variant={tab() === "crop" ? "secondary" : "ghost"} onClick={() => setTab("crop")}>Cropped Match</Button>
            <Button variant={tab() === "metadata" ? "secondary" : "ghost"} onClick={() => setTab("metadata")}>Metadata</Button>
          </div>

          <Show
            when={tab() !== "metadata"}
            fallback={
              <div class="result-meta">
                <div class="result-meta-toolbar">
                  <input
                    class="v-input"
                    placeholder="Search class or confidence"
                    value={metadataQuery()}
                    onInput={(event) => {
                      setMetadataQuery(event.currentTarget.value);
                      setMetadataPage(1);
                    }}
                  />
                  <select
                    class="v-input"
                    value={metadataSort()}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      if (value === "confidence-desc" || value === "confidence-asc" || value === "class-asc") {
                        setMetadataSort(value);
                        setMetadataPage(1);
                      }
                    }}
                  >
                    <option value="confidence-desc">Confidence high to low</option>
                    <option value="confidence-asc">Confidence low to high</option>
                    <option value="class-asc">Class A-Z</option>
                  </select>
                </div>

                <div class="result-meta-list">
                  <Show
                    when={pagedDetections().length > 0}
                    fallback={<div class="metadata-row"><span>#</span><span>-</span><span>-</span><span>No detections match current filter</span><span /></div>}
                  >
                    <For each={pagedDetections()}>
                      {(item, index) => {
                        const absoluteIndex = () => (metadataPage() - 1) * PAGE_SIZE + index();
                        const isActive = () => selectedDetectionId() === absoluteIndex();

                        return (
                          <div class={`metadata-row ${isActive() ? "active" : ""}`}>
                            <span>#{absoluteIndex() + 1}</span>
                            <span>{item.class}</span>
                            <span>{(item.confidence * 100).toFixed(2)}%</span>
                            <span>{item.bbox.map((value) => value.toFixed(0)).join(", ")}</span>
                            <Button
                              variant="ghost"
                              onClick={() => setSelectedDetectionId(absoluteIndex())}
                              title="Focus detection"
                            >
                              <Crosshair size={14} />
                            </Button>
                          </div>
                        );
                      }}
                    </For>
                  </Show>
                </div>

                <div class="result-meta-toolbar">
                  <Button
                    variant="ghost"
                    onClick={() => setMetadataPage(Math.max(1, metadataPage() - 1))}
                    disabled={metadataPage() <= 1}
                  >
                    <ChevronLeft size={14} /> Prev
                  </Button>
                  <span>Page {metadataPage()} / {pageCount()}</span>
                  <Button
                    variant="ghost"
                    onClick={() => setMetadataPage(Math.min(pageCount(), metadataPage() + 1))}
                    disabled={metadataPage() >= pageCount()}
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            }
          >
            <div class="result-canvas">
              <Show when={tab() === "crop"} fallback={
                <Image
                  src={previewSrc()}
                  class="result-image"
                  boxes={tab() === "overlay" ? overlayDetections() : []}
                  highlight={tab() === "overlay" && overlayEnabled()}
                />
              }>
                <img src={cropSrc()} class="result-image" alt="Selected detection crop" />
              </Show>
            </div>
          </Show>
        </div>

        <aside class="result-side note-paper">
          <h2>Detection</h2>
          <p class="result-lead">{selectedDetection() ? "It’s Waldo" : "No confident match"}</p>

          <div class="result-side-info">
            <p>Total detections: {runtimeResult()?.detections.length ?? 0}</p>
            <p>Current confidence: {selectedDetection() ? `${(selectedDetection()!.confidence * 100).toFixed(2)}%` : "N/A"}</p>
            <p>Overlay boxes shown: {overlayDetections().length}</p>
          </div>

          <label>
            Overlay limit
            <input
              class="v-input"
              type="number"
              min="1"
              max="500"
              value={overlayLimit()}
              onInput={(event) => setOverlayLimit(Number(event.currentTarget.value || 1))}
            />
          </label>

          <label>
            Overlay minimum confidence
            <input
              class="v-input"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={overlayMinConfidence()}
              onInput={(event) => setOverlayMinConfidence(Math.max(0, Math.min(1, Number(event.currentTarget.value || 0))))}
            />
          </label>

          <div class="result-actions">
            <Button variant="secondary" onClick={() => setOverlayEnabled(!overlayEnabled())}>
              {overlayEnabled() ? "Hide Overlay" : "Show Overlay"}
            </Button>
            <Button variant="primary" onClick={downloadResult} disabled={busy()}>
              <Download size={16} /> {busy() ? "Saving..." : "Download Result"}
            </Button>
            <Button variant="ghost" onClick={openSavedFile}>Open Saved File</Button>
            <Button variant="ghost" onClick={openSavedFolder}><FolderOpen size={16} /> Open Output Folder</Button>
            <Button variant="danger" onClick={() => navigate("/search/new")}><Search size={16} /> New Search</Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
