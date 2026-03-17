import { createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";
import ImagePlus from "lucide-solid/icons/image-plus";
import Play from "lucide-solid/icons/play";
import X from "lucide-solid/icons/x";
import Stethoscope from "lucide-solid/icons/stethoscope";

import Button from "@/components/Buttton";
import { createObjectUrlFromPath } from "@/utils/image";
import {
  loadAppSettings,
  MAX_CONFIDENCE_THRESHOLD,
  MAX_TIMEOUT_SECONDS,
  MIN_CONFIDENCE_THRESHOLD,
  MIN_TIMEOUT_SECONDS,
  saveAppSettings,
} from "@/utils/settings";
import {
  getSelectedImagePath,
  setSearchSettings,
  setSelectedImagePath,
} from "@/state/searchState";

export default function SearchNewRoute() {
  const navigate = useNavigate();
  const selectedImagePath = getSelectedImagePath();

  const [previewSrc, setPreviewSrc] = createSignal("");
  const [timeoutInput, setTimeoutInput] = createSignal("30");
  const [confidenceInput, setConfidenceInput] = createSignal("0.25");
  const [inferenceDevice, setInferenceDevice] = createSignal<"auto" | "gpu" | "cpu">("auto");
  const [errorMessage, setErrorMessage] = createSignal("");

  async function refreshPreview(path: string) {
    const current = previewSrc();
    if (current.startsWith("blob:")) {
      URL.revokeObjectURL(current);
    }

    const next = await createObjectUrlFromPath(path);
    setPreviewSrc(next);
  }

  onMount(() => {
    void (async () => {
      const settings = await loadAppSettings();
      setTimeoutInput(settings.timeout.toString());
      setConfidenceInput(settings.confidenceThreshold.toString());
      setInferenceDevice(settings.inferenceDevice);

      if (!selectedImagePath()) {
        navigate("/home");
        return;
      }

      await refreshPreview(selectedImagePath());
    })();
  });

  onCleanup(() => {
    const current = previewSrc();
    if (current.startsWith("blob:")) {
      URL.revokeObjectURL(current);
    }
  });

  async function replaceImage() {
    const file = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "bmp", "webp"] }],
    });

    if (!file || Array.isArray(file)) {
      return;
    }

    setSelectedImagePath(file);
    await refreshPreview(file);
  }

  async function startSearch() {
    setErrorMessage("");

    const timeout = Number(timeoutInput().trim());
    const confidenceThreshold = Number(confidenceInput().trim());

    if (!Number.isInteger(timeout) || timeout < MIN_TIMEOUT_SECONDS || timeout > MAX_TIMEOUT_SECONDS) {
      setErrorMessage(
        `Timeout must be an integer between ${MIN_TIMEOUT_SECONDS} and ${MAX_TIMEOUT_SECONDS}.`,
      );
      return;
    }

    if (
      !Number.isFinite(confidenceThreshold) ||
      confidenceThreshold < MIN_CONFIDENCE_THRESHOLD ||
      confidenceThreshold > MAX_CONFIDENCE_THRESHOLD
    ) {
      setErrorMessage(
        `Confidence threshold must be between ${MIN_CONFIDENCE_THRESHOLD} and ${MAX_CONFIDENCE_THRESHOLD}.`,
      );
      return;
    }

    const settings = await loadAppSettings();
    const snapshot = {
      confidenceThreshold: Number(confidenceThreshold.toFixed(2)),
      timeout,
      inferenceDevice: inferenceDevice(),
      saveLocation: settings.saveLocation,
    } as const;

    setSearchSettings(snapshot);

    await saveAppSettings({
      autoStart: settings.autoStart,
      timeout: snapshot.timeout,
      saveLocation: settings.saveLocation,
      inferenceDevice: snapshot.inferenceDevice,
      confidenceThreshold: snapshot.confidenceThreshold,
    });

    navigate("/search/processing");
  }

  return (
    <section class="page search-page">
      <header class="page-header">
        <h1>Prepare Search</h1>
      </header>

      <div class="search-layout">
        <div class="search-preview vintage-paper">
          <img src={previewSrc()} alt="Selected crowd" class="search-preview-image" />
          <div class="search-file-row">
            <span>{selectedImagePath().split(/[/\\]/).at(-1)}</span>
            <Button variant="ghost" onClick={replaceImage}>
              <ImagePlus size={16} /> Replace Image
            </Button>
          </div>
        </div>

        <div class="search-controls note-paper">
          <h2>Search Settings</h2>

          <label>
            Confidence Threshold
            <input
              class="v-input"
              value={confidenceInput()}
              onInput={(event) => setConfidenceInput(event.currentTarget.value)}
              type="number"
              min={MIN_CONFIDENCE_THRESHOLD}
              max={MAX_CONFIDENCE_THRESHOLD}
              step="0.01"
            />
          </label>

          <label>
            Timeout (seconds)
            <input
              class="v-input"
              value={timeoutInput()}
              onInput={(event) => setTimeoutInput(event.currentTarget.value)}
              type="number"
              min={MIN_TIMEOUT_SECONDS}
              max={MAX_TIMEOUT_SECONDS}
              step="1"
            />
          </label>

          <label>
            Inference Device
            <select
              class="v-input"
              value={inferenceDevice()}
              onChange={(event) =>
                setInferenceDevice(event.currentTarget.value as "auto" | "gpu" | "cpu")
              }
            >
              <option value="auto">Auto (GPU if available)</option>
              <option value="gpu">GPU only</option>
              <option value="cpu">CPU only</option>
            </select>
          </label>

          {errorMessage() ? <p class="error-text">{errorMessage()}</p> : null}

          <div class="search-actions">
            <Button variant="secondary" onClick={startSearch}>
              <Play size={16} /> Start Search
            </Button>
            <Button variant="danger" onClick={() => navigate("/home")}>
              <X size={16} /> Cancel
            </Button>
            <Button variant="ghost" onClick={() => navigate("/diagnostics")}>
              <Stethoscope size={16} /> Run Diagnostics
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
