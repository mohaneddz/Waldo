import { Show, createSignal } from "solid-js";
import Folder from "lucide-solid/icons/folder";

import Button from "@/components/Buttton";
import useSettings from "@/hooks/useSettings";

export default function SettingsRoute() {
  const {
    autoStart,
    confidenceThresholdInput,
    errorMessage,
    inferenceDevice,
    loading,
    pickSaveLocation,
    saveLocation,
    saveSettings,
    setAutoStart,
    setConfidenceThresholdInput,
    setInferenceDevice,
    setSaveLocation,
    setTimeoutInput,
    successMessage,
    timeoutInput,
  } = useSettings();

  const [saving, setSaving] = createSignal(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section class="page settings-page">
      <header class="page-header">
        <h1>Settings</h1>
      </header>

      <div class="settings-layout">
        <div class="settings-grid vintage-paper">
          <label>
            Preload model on launch
            <select
              class="v-input"
              value={autoStart() ? "enabled" : "disabled"}
              onChange={(event) => setAutoStart(event.currentTarget.value === "enabled")}
              disabled={loading() || saving()}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>

          <label>
            Inference device
            <select
              class="v-input"
              value={inferenceDevice()}
              onChange={(event) =>
                setInferenceDevice(event.currentTarget.value as "auto" | "gpu" | "cpu")
              }
              disabled={loading() || saving()}
            >
              <option value="auto">Auto (GPU if available)</option>
              <option value="gpu">GPU only</option>
              <option value="cpu">CPU only</option>
            </select>
          </label>

          <label>
            Timeout (seconds)
            <input
              class="v-input"
              value={timeoutInput()}
              type="number"
              min="1"
              max="600"
              step="1"
              onInput={(event) => setTimeoutInput(event.currentTarget.value)}
            />
          </label>

          <label>
            Confidence threshold
            <input
              class="v-input"
              value={confidenceThresholdInput()}
              type="number"
              min="0.05"
              max="0.95"
              step="0.01"
              onInput={(event) => setConfidenceThresholdInput(event.currentTarget.value)}
            />
          </label>

          <label class="full-row">
            Save location
            <div class="row-inline">
              <input
                class="v-input"
                value={saveLocation()}
                onInput={(event) => setSaveLocation(event.currentTarget.value)}
              />
              <Button variant="ghost" onClick={pickSaveLocation}>
                <Folder size={16} /> Browse
              </Button>
            </div>
          </label>

          <div class="full-row row-inline">
            <Button variant="secondary" onClick={handleSave} disabled={loading() || saving()}>
              {saving() ? "Saving..." : "Save Settings"}
            </Button>
          </div>

          <div class="full-row">
            <Show when={errorMessage()}>
              <p class="error-text">{errorMessage()}</p>
            </Show>
            <Show when={!errorMessage() && successMessage()}>
              <p class="ok-text">{successMessage()}</p>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
}
