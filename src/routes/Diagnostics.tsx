import { For, Show, createSignal, onMount } from "solid-js";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import PlayCircle from "lucide-solid/icons/play-circle";

import Button from "@/components/Buttton";
import {
  getInferenceRuntimeState,
  loadModel,
  resetModel,
} from "@/services/inference";
import {
  appendDiagnosticSnapshot,
  loadDiagnosticSnapshots,
} from "@/utils/appRecords";
import {
  getLastError,
} from "@/state/searchState";
import { loadAppSettings, validateSaveLocation } from "@/utils/settings";
import type { DiagnosticSnapshot } from "@/types/app";

export default function DiagnosticsRoute() {
  const lastError = getLastError();

  const [snapshots, setSnapshots] = createSignal<DiagnosticSnapshot[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [runtimeLabel, setRuntimeLabel] = createSignal("Unknown");

  onMount(() => {
    void refreshDiagnostics();
  });

  async function refreshDiagnostics() {
    setBusy(true);
    try {
      const settings = await loadAppSettings();
      const saveValidation = await validateSaveLocation(settings.saveLocation);
      const runtimeState = getInferenceRuntimeState();
      const now = new Date().toISOString();

      const snapshot: DiagnosticSnapshot = {
        id: crypto.randomUUID(),
        timestamp: now,
        gpuAvailable: "gpu" in navigator,
        modelLoaded: runtimeState.modelLoaded,
        deviceUsed: runtimeState.deviceUsed,
        saveLocationValid: !saveValidation.error,
        lastError: lastError() || "",
      };

      await appendDiagnosticSnapshot(snapshot);
      const entries = await loadDiagnosticSnapshots();
      setSnapshots(entries);

      setRuntimeLabel(
        runtimeState.modelLoaded
          ? `Loaded (${runtimeState.deviceUsed ?? "unknown"})`
          : "Not loaded",
      );
    } finally {
      setBusy(false);
    }
  }

  async function preloadModel() {
    setBusy(true);
    try {
      const settings = await loadAppSettings();
      await loadModel(settings.inferenceDevice);
    } finally {
      setBusy(false);
      await refreshDiagnostics();
    }
  }

  async function restartRuntime() {
    setBusy(true);
    try {
      await resetModel();
    } finally {
      setBusy(false);
      await refreshDiagnostics();
    }
  }

  return (
    <section class="page diagnostics-page">
      <header class="page-header">
        <h1>Diagnostics</h1>
        <p>Runtime: {runtimeLabel()}</p>
      </header>

      <div class="diagnostics-layout">
        <div class="diagnostics-actions vintage-paper">
          <Button variant="ghost" onClick={refreshDiagnostics} disabled={busy()}>
            <RefreshCw size={16} /> Refresh Checks
          </Button>
          <Button variant="secondary" onClick={preloadModel} disabled={busy()}>
            <PlayCircle size={16} /> Load Model
          </Button>
          <Button variant="danger" onClick={restartRuntime} disabled={busy()}>
            <RotateCcw size={16} /> Reset Runtime
          </Button>

          <Show when={lastError()}>
            <p class="error-text">Last error: {lastError()}</p>
          </Show>
        </div>

        <div class="diagnostic-list note-paper">
          <h2>Recent snapshots</h2>
          <Show when={snapshots().length > 0} fallback={<p>No diagnostics yet.</p>}>
            <For each={snapshots()}>
              {(snapshot) => (
                <article class="diagnostic-item">
                  <h3>{new Date(snapshot.timestamp).toLocaleString()}</h3>
                  <p>GPU available: {snapshot.gpuAvailable ? "yes" : "no"}</p>
                  <p>Model loaded: {snapshot.modelLoaded ? "yes" : "no"}</p>
                  <p>Device used: {snapshot.deviceUsed ?? "none"}</p>
                  <p>Save location valid: {snapshot.saveLocationValid ? "yes" : "no"}</p>
                  <small class={snapshot.lastError ? "error-text" : "ok-text"}>
                    {snapshot.lastError || "No runtime errors"}
                  </small>
                </article>
              )}
            </For>
          </Show>
        </div>
      </div>
    </section>
  );
}
