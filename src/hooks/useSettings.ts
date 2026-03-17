import { open } from "@tauri-apps/plugin-dialog";
import { createSignal, onMount } from "solid-js";

import type { DevicePreference } from "@/services/inference";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_TIMEOUT_SECONDS,
  MAX_CONFIDENCE_THRESHOLD,
  MAX_TIMEOUT_SECONDS,
  MIN_CONFIDENCE_THRESHOLD,
  MIN_TIMEOUT_SECONDS,
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
  const [confidenceThresholdInput, setConfidenceThresholdInput] = createSignal(
    DEFAULT_CONFIDENCE_THRESHOLD.toString(),
  );
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
      setConfidenceThresholdInput(settings.confidenceThreshold.toString());
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
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected !== null && !Array.isArray(selected)) {
        const validatedLocation = await validateSaveLocation(selected);
        if (validatedLocation.error) {
          setErrorMessage(validatedLocation.error);
        } else {
          setSaveLocation(validatedLocation.value);
        }
      }
    } catch (error) {
      console.error("Failed to open dialog:", error);
      setErrorMessage("Failed to browse for save location.");
    }
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

    const parsedConfidence = Number(confidenceThresholdInput().trim());
    if (!Number.isFinite(parsedConfidence)) {
      setErrorMessage("Confidence threshold must be a number.");
      return false;
    }

    if (
      parsedConfidence < MIN_CONFIDENCE_THRESHOLD ||
      parsedConfidence > MAX_CONFIDENCE_THRESHOLD
    ) {
      setErrorMessage(
        `Confidence threshold must be between ${MIN_CONFIDENCE_THRESHOLD} and ${MAX_CONFIDENCE_THRESHOLD}.`,
      );
      return false;
    }

    try {
      const settings = await saveAppSettings({
        autoStart: autoStart(),
        timeout: parsedTimeout,
        saveLocation: validatedLocation.value,
        inferenceDevice: inferenceDevice(),
        confidenceThreshold: Number(parsedConfidence.toFixed(2)),
      });

      setAutoStart(settings.autoStart);
      setTimeoutInput(settings.timeout.toString());
      setSaveLocation(settings.saveLocation);
      setInferenceDevice(settings.inferenceDevice);
      setConfidenceThresholdInput(settings.confidenceThreshold.toString());
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
    saveLocation,
    saveSettings,
    setAutoStart,
    setInferenceDevice,
    setSaveLocation,
    setConfidenceThresholdInput,
    setTimeoutInput,
    successMessage,
    timeoutInput,
    confidenceThresholdInput,
  };
}
