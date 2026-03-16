import Button from "@/components/Buttton";
import useSettings from "@/hooks/useSettings";
import NumberInput from "@/components/NumberInput";
import TextInput from "@/components/TextInput";

import { createSignal } from "solid-js";

export default function About() {
  const {
    handleGoBack: goBackOriginal,
    saveSettings,
    autoStart,
    setAutoStart,
    timeout,
    setTimeout,
    saveLocation,
    setSaveLocation
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
            <label for="autoStart">AI AutoStart</label>
            <select
              id="autoStart"
              class="w-50 text-sm pl-4 pr-4 py-2 bg-primary-light/40 border border-border-light-2 rounded-md text-white placeholder-white/70 focus:outline-none focus:border-accent"
              value={autoStart() ? "enabled" : "disabled"}
              onChange={(e) => setAutoStart(e.currentTarget.value === "enabled")}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {/* Timeout */}
          <div class="flex justify-between items-center w-full">
            <label for="timeout">Timeout</label>
            <NumberInput
              number={timeout().toString()}
              setNumber={(value) => setTimeout(Number(value))}
              id="timeout"
              placeholder="Enter timeout in seconds"
              readonly={false}
            />
          </div>

          {/* Save Location */}
          <div class="flex justify-between items-center w-full">
            <label for="saveLocation">Save location</label>
            <TextInput
              text={saveLocation()}
              setText={(value) => setSaveLocation(value)}
              id="saveLocation"
              placeholder="Enter save location"
              readonly={false}
            />
          </div>
        </div>

        {/* Buttons */}
        <div class="grid grid-cols-2 justify-stretch gap-4 my-12 w-full">
          <Button class="w-full " variant="ghost" onClick={handleGoBack} disabled={saving()}>
            Go Back
          </Button>
          <Button class="w-full" variant="primary" onClick={handleSave} disabled={saving()}>
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
