import { open } from "@tauri-apps/plugin-dialog";
import { createSignal, onMount } from "solid-js";

import type { DevicePreference } from "@/services/inference";
import {
  DEFAULT_TIMEOUT_SECONDS,
  MAX_TIMEOUT_SECONDS,
  MIN_TIMEOUT_SECONDS,
  getDefaultSaveLocation,
  loadAppSettings,
  saveAppSettings,
  validateSaveLocation,
} from "@/utils/settings";

export default function useSettings() {
  const [autoStart, setAutoStart] = createSignal(false);
  const [timeoutInput, setTimeoutInput] = createSignal(
    DEFAULT_TIMEOUT_SECONDS.toString(),
  );
  const [saveLocation, setSaveLocation] = createSignal("");
  const [inferenceDevice, setInferenceDevice] =
    createSignal<DevicePreference>("auto");
  const [loading, setLoading] = createSignal(true);
  const [errorMessage, setErrorMessage] = createSignal("");
  const [successMessage, setSuccessMessage] = createSignal("");

  const clearMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  onMount(async () => {
    try {
      const settings = await loadAppSettings();
      setAutoStart(settings.autoStart);
      setTimeoutInput(settings.timeout.toString());
      setSaveLocation(settings.saveLocation);
      setInferenceDevice(settings.inferenceDevice);
    } catch (error) {
      console.error("Failed to load settings:", error);
      setErrorMessage("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  });

  function handleGoBack() {
    window.history.back();
  }

  async function pickSaveLocation() {
    clearMessages();

    const directory = await open({
      directory: true,
      multiple: false,
    });

    if (!directory || Array.isArray(directory)) {
      return;
    }

    const validatedLocation = await validateSaveLocation(directory);
    if (validatedLocation.error) {
      setErrorMessage(validatedLocation.error);
      return;
    }

    setSaveLocation(validatedLocation.value);
  }

  async function resetSaveLocation() {
    clearMessages();
    setSaveLocation(await getDefaultSaveLocation());
  }

  async function saveSettings() {
    clearMessages();

    const parsedTimeout = Number(timeoutInput().trim());
    if (!Number.isInteger(parsedTimeout)) {
      setErrorMessage("Timeout must be a whole number.");
      return false;
    }

    if (parsedTimeout < MIN_TIMEOUT_SECONDS || parsedTimeout > MAX_TIMEOUT_SECONDS) {
      setErrorMessage(
        `Timeout must be between ${MIN_TIMEOUT_SECONDS} and ${MAX_TIMEOUT_SECONDS} seconds.`,
      );
      return false;
    }

    const validatedLocation = await validateSaveLocation(saveLocation());
    if (validatedLocation.error) {
      setErrorMessage(validatedLocation.error);
      return false;
    }

    try {
      const settings = await saveAppSettings({
        autoStart: autoStart(),
        timeout: parsedTimeout,
        saveLocation: validatedLocation.value,
        inferenceDevice: inferenceDevice(),
      });

      setAutoStart(settings.autoStart);
      setTimeoutInput(settings.timeout.toString());
      setSaveLocation(settings.saveLocation);
      setInferenceDevice(settings.inferenceDevice);
      setSuccessMessage("Settings saved.");
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save settings.",
      );
      return false;
    }
  }

  return {
    autoStart,
    errorMessage,
    handleGoBack,
    inferenceDevice,
    loading,
    pickSaveLocation,
    resetSaveLocation,
    saveLocation,
    saveSettings,
    setAutoStart,
    setInferenceDevice,
    setSaveLocation,
    setTimeoutInput,
    successMessage,
    timeoutInput,
  };
}
