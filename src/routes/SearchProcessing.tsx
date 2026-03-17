import { For, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import StopCircle from "lucide-solid/icons/stop-circle";

import Button from "@/components/Buttton";
import { runInference, type InferenceProgressEvent } from "@/services/inference";
import {
  appendDiagnosticSnapshot,
  appendSearchSession,
} from "@/utils/appRecords";
import {
  getLastError,
  getProgressDetail,
  getProgressMessage,
  getProgressPercent,
  getProgressSteps,
  getSearchSettings,
  getSelectedImagePath,
  getTopDetectionConfidence,
  markProgressStep,
  resetProgress,
  setIsProcessing,
  setLastError,
  setProgressDetail,
  setProgressMessage,
  setProgressPercent,
  setRuntimeResult,
} from "@/state/searchState";
import { createObjectUrlFromPath } from "@/utils/image";

const STEP_KEYS = {
  compare: "compare",
  finalize: "finalize",
  prepare: "prepare",
  scan: "scan",
} as const;

function applyProgressEvent(event: InferenceProgressEvent) {
  setProgressPercent(Math.round(event.progress * 100));
  setProgressMessage(event.message);
  setProgressDetail(event.details ?? "");

  if (event.stage === "prepare" || event.stage === "model") {
    markProgressStep(STEP_KEYS.prepare, "active", event.message);
  }

  if (event.stage === "infer") {
    markProgressStep(STEP_KEYS.prepare, "done", "Model loaded");

    if (event.progress < 0.55) {
      markProgressStep(STEP_KEYS.scan, "active", event.details);
    } else {
      markProgressStep(STEP_KEYS.scan, "done", "All regions scanned");
      markProgressStep(STEP_KEYS.compare, "active", "Ranking detections");
    }
  }

  if (event.stage === "postprocess") {
    markProgressStep(STEP_KEYS.compare, "done", "Confidence thresholds applied");
    markProgressStep(STEP_KEYS.finalize, "active", event.message);
  }

  if (event.stage === "complete") {
    markProgressStep(STEP_KEYS.finalize, "done", event.details);
  }
}

export default function SearchProcessingRoute() {
  const navigate = useNavigate();
  const selectedImagePath = getSelectedImagePath();
  const searchSettings = getSearchSettings();

  const progressPercent = getProgressPercent();
  const progressMessage = getProgressMessage();
  const progressDetail = getProgressDetail();
  const progressSteps = getProgressSteps();
  const lastError = getLastError();

  const [runFinished, setRunFinished] = createSignal(false);
  const [previewSrc, setPreviewSrc] = createSignal("");
  let cancelled = false;

  onMount(() => {
    void (async () => {
      if (selectedImagePath()) {
        const src = await createObjectUrlFromPath(selectedImagePath());
        setPreviewSrc(src);
      }
    })();
    void executeSearch();
  });

  onCleanup(() => {
    cancelled = true;
    setIsProcessing(false);
    const current = previewSrc();
    if (current.startsWith("blob:")) {
      URL.revokeObjectURL(current);
    }
  });

  async function executeSearch() {
    if (!selectedImagePath() || !searchSettings()) {
      navigate("/search/new");
      return;
    }

    resetProgress();
    setIsProcessing(true);
    setLastError("");
    markProgressStep(STEP_KEYS.prepare, "active", "Initializing runtime");

    const startedAt = new Date().toISOString();
    const sourceName = selectedImagePath().split(/[/\\]/).at(-1) ?? "image";
    const sessionId = crypto.randomUUID();

    try {
      const inferenceResult = await runInference(selectedImagePath(), {
        devicePreference: searchSettings()!.inferenceDevice,
        saveLocation: searchSettings()!.saveLocation,
        confidenceThreshold: searchSettings()!.confidenceThreshold,
        onProgress: (event) => {
          if (cancelled) {
            return;
          }
          applyProgressEvent(event);
        },
      });

      if (cancelled) {
        return;
      }

      const outcome = inferenceResult.detections.length > 0 ? "found" : "not_found";
      const completedAt = new Date().toISOString();

      await appendSearchSession({
        id: sessionId,
        sourcePath: selectedImagePath(),
        sourceName,
        timestamp: completedAt,
        outcome,
        detectionsCount: inferenceResult.detections.length,
        topConfidence: getTopDetectionConfidence(inferenceResult.detections),
        outputPath: "",
        deviceUsed: inferenceResult.deviceUsed,
        settings: searchSettings()!,
      });

      setRuntimeResult({
        sessionId,
        sourcePath: selectedImagePath(),
        sourceName,
        detections: inferenceResult.detections,
        deviceUsed: inferenceResult.deviceUsed,
        outcome,
        outputPath: "",
        settings: searchSettings()!,
        startedAt,
        completedAt,
      });

      setRunFinished(true);
      setIsProcessing(false);

      if (outcome === "found") {
        navigate("/results/review");
      } else {
        navigate("/results/not-found");
      }
    } catch (error) {
      if (cancelled) {
        return;
      }

      const message = error instanceof Error ? error.message : "Inference failed.";
      const completedAt = new Date().toISOString();

      setLastError(message);
      markProgressStep(STEP_KEYS.finalize, "error", message);
      setProgressMessage("Search failed");
      setProgressDetail(message);

      await appendSearchSession({
        id: sessionId,
        sourcePath: selectedImagePath(),
        sourceName,
        timestamp: completedAt,
        outcome: "error",
        detectionsCount: 0,
        topConfidence: null,
        outputPath: "",
        deviceUsed: null,
        settings: searchSettings()!,
        errorMessage: message,
      });

      await appendDiagnosticSnapshot({
        id: crypto.randomUUID(),
        timestamp: completedAt,
        gpuAvailable: "gpu" in navigator,
        modelLoaded: false,
        deviceUsed: null,
        saveLocationValid: true,
        lastError: message,
      });

      setRuntimeResult({
        sessionId,
        sourcePath: selectedImagePath(),
        sourceName,
        detections: [],
        deviceUsed: null,
        outcome: "error",
        outputPath: "",
        settings: searchSettings()!,
        startedAt,
        completedAt,
        errorMessage: message,
      });

      setIsProcessing(false);
      navigate("/results/not-found");
    }
  }

  return (
    <section class="page processing-page">
      <header class="page-header">
        <h1>Processing...</h1>
        <p>{progressMessage()}</p>
      </header>

      <div class="processing-body vintage-paper">
        <div class="processing-preview">
          <img src={previewSrc()} alt="Current search preview" />
        </div>

        <div class="progress-meter">
          <div class="progress-bar" style={{ width: `${progressPercent()}%` }} />
        </div>
        <p class="progress-meta">{progressPercent()}% complete</p>
        <p class="progress-detail">{progressDetail()}</p>

        <ul class="progress-steps">
          <For each={progressSteps()}>
            {(step) => (
              <li class={`step step-${step.status}`}>
                <span>{step.label}</span>
                <small>{step.detail ?? "Pending"}</small>
              </li>
            )}
          </For>
        </ul>

        {lastError() ? <p class="error-text">{lastError()}</p> : null}

        <div class="processing-actions">
          <Button
            variant="danger"
            onClick={() => {
              cancelled = true;
              setIsProcessing(false);
              resetProgress();
              navigate("/search/new");
            }}
            disabled={runFinished()}
          >
            <StopCircle size={16} /> Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={executeSearch}
            disabled={!runFinished() && !lastError()}
          >
            <RotateCcw size={16} /> Retry
          </Button>
        </div>
      </div>
    </section>
  );
}
