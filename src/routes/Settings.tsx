import Button from "@/components/Buttton";
import useSettings from "@/hooks/useSettings";
import NumberInput from "@/components/NumberInput";
import TextInput from "@/components/TextInput";

import { Show, createSignal } from "solid-js";

export default function Settings() {
  const {
    handleGoBack: goBackOriginal,
    saveSettings,
    autoStart,
    setAutoStart,
    timeoutInput,
    setTimeoutInput,
    saveLocation,
    setSaveLocation,
    inferenceDevice,
    setInferenceDevice,
    pickSaveLocation,
    resetSaveLocation,
    loading,
    errorMessage,
    successMessage,
  } = useSettings();

  const [saving, setSaving] = createSignal(false);
  const [goingBack, setGoingBack] = createSignal(false);

  const handleGoBack = () => {
    setGoingBack(true);
    window.setTimeout(() => {
      goBackOriginal();
    }, 300); // matches exit animation
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      class={`center min-h-screen ${
        goingBack() ? "animate-fadeOutScale" : "animate-fadeInScale"
      }`}
    >
      <div class="bg-primary-dark min-w-[40vw] min-h-[40vw] border rounded-lg center flex-col p-8">
        <h1 class="text-7xl font-bold text-center my-12">Settings</h1>

        <div class="center flex-col gap-12 h-full w-full max-w-[30vw]">
          {/* AutoStart as Select */}
          <div class="flex justify-between items-center w-full">
            <label for="autoStart">Preload model</label>
            <select
              id="autoStart"
              class="w-50 text-sm pl-4 pr-4 py-2 bg-primary-light/40 border border-border-light-2 rounded-md text-white placeholder-white/70 focus:outline-none focus:border-accent"
              value={autoStart() ? "enabled" : "disabled"}
              onChange={(e) => setAutoStart(e.currentTarget.value === "enabled")}
              disabled={loading() || saving()}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div class="flex justify-between items-center w-full">
            <label for="inferenceDevice">Inference device</label>
            <select
              id="inferenceDevice"
              class="w-50 text-sm pl-4 pr-4 py-2 bg-primary-light/40 border border-border-light-2 rounded-md text-white placeholder-white/70 focus:outline-none focus:border-accent"
              value={inferenceDevice()}
              onChange={(e) => setInferenceDevice(e.currentTarget.value as "auto" | "gpu" | "cpu")}
              disabled={loading() || saving()}
            >
              <option value="auto">Auto (GPU if available)</option>
              <option value="gpu">GPU only</option>
              <option value="cpu">CPU only</option>
            </select>
          </div>

          {/* Timeout */}
          <div class="flex justify-between items-center w-full">
            <label for="timeout">Timeout</label>
            <NumberInput
              number={timeoutInput()}
              setNumber={setTimeoutInput}
              id="timeout"
              placeholder="Enter timeout in seconds"
              readonly={loading() || saving()}
            />
          </div>

          {/* Save Location */}
          <div class="flex justify-between items-start w-full gap-4">
            <label for="saveLocation">Save location</label>
            <div class="flex-1 space-y-3">
              <TextInput
                class="w-full"
                text={saveLocation()}
                setText={setSaveLocation}
                id="saveLocation"
                placeholder="Choose or enter a save location"
                readonly={loading() || saving()}
              />
              <div class="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={pickSaveLocation}
                  disabled={loading() || saving()}
                >
                  Browse
                </Button>
                <Button
                  variant="ghost"
                  onClick={resetSaveLocation}
                  disabled={loading() || saving()}
                >
                  Use Default
                </Button>
              </div>
              <p class="text-xs text-white/70">
                Save folders must stay inside Downloads, Documents, Desktop, Pictures, Public, Home, Temp, App Data, or App Local Data.
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 min-h-6 text-center">
          <Show when={errorMessage()}>
            <p class="text-sm text-red-300">{errorMessage()}</p>
          </Show>
          <Show when={!errorMessage() && successMessage()}>
            <p class="text-sm text-emerald-300">{successMessage()}</p>
          </Show>
        </div>

        {/* Buttons */}
        <div class="grid grid-cols-2 justify-stretch gap-4 my-12 w-full">
          <Button class="w-full " variant="ghost" onClick={handleGoBack} disabled={saving()}>
            Go Back
          </Button>
          <Button class="w-full" variant="primary" onClick={handleSave} disabled={saving() || loading()}>
            {saving() ? (
              <span class="flex items-center justify-center gap-2">
                <span
                  class="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
