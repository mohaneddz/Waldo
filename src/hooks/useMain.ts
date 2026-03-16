import { useLocation } from "@solidjs/router";
import { onCleanup, onMount, createEffect, createSignal } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";

import { createObjectUrlFromPath } from "@/utils/image";
import {
  loadModel,
  resetModel,
  runInference,
  saveInferenceResult,
  type DevicePreference,
  type Detection,
  type RuntimeDevice,
} from "@/services/inference";
import { hasConfiguredSaveLocation, loadAppSettings } from "@/utils/settings";

export default function useMain() {
  const location = useLocation();
  const [img, setImg] = createSignal("");
  const [imgPath, setImgPath] = createSignal("");
  const [boxes, setBoxes] = createSignal<Detection[]>([]);
  const [state, setState] = createSignal("ready");
  const [highlight, setHighlight] = createSignal(false);
  const [timeout, setTimeout] = createSignal(10);
  const [inferenceDevice, setInferenceDevice] =
    createSignal<DevicePreference>("auto");
  const [deviceUsed, setDeviceUsed] = createSignal<RuntimeDevice | null>(null);
  const [lastResultPath, setLastResultPath] = createSignal("");
  const [hasSaveLocation, setHasSaveLocation] = createSignal(false);

  async function syncSettings() {
    const settings = await loadAppSettings();
    setHasSaveLocation(await hasConfiguredSaveLocation());
    setTimeout(settings.timeout);
    setInferenceDevice(settings.inferenceDevice);
    return settings;
  }

  function handleGoBack() {
    window.history.back();
  }

  async function handleFindWaldo() {
    await sendImg();
  }

  async function handleDownloadResult() {
    if (!imgPath()) {
      throw new Error("No image selected.");
    }

    const settings = await syncSettings();
    const savedPath = await saveInferenceResult(
      imgPath(),
      boxes(),
      settings.saveLocation,
    );
    setLastResultPath(savedPath);
    return savedPath;
  }

  onMount(async () => {
    const stateObj = location.state;
    if (!stateObj || typeof stateObj !== "object" || !("path" in stateObj)) {
      console.error("Invalid state object:", stateObj);
      return;
    }

    const path = (stateObj as { path: string }).path;
    await syncSettings();

    await loadImage(path);
  });

  createEffect(() => {
    if (location.pathname === "/main") {
      void syncSettings();
    }
  });

  onCleanup(() => {
    const current = img();
    if (current.startsWith("blob:")) {
      URL.revokeObjectURL(current);
    }
  });

  async function loadImage(path: string) {
    setImgPath(path);
    const preview = await createObjectUrlFromPath(path);
    const current = img();
    if (current.startsWith("blob:")) {
      URL.revokeObjectURL(current);
    }
    setImg(preview);
    setBoxes([]);
    setState("ready");
    setLastResultPath("");
  }

  async function pickNewPicture() {
    const file = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Images", extensions: ["png", "jpeg", "jpg"] }],
    });
    if (!file || Array.isArray(file)) return;
    await loadImage(file as string);
    setHighlight(false);
  }

  async function reloadModel() {
    const settings = await syncSettings();
    await resetModel();
    const runtimeDevice = await loadModel(settings.inferenceDevice);
    setDeviceUsed(runtimeDevice);
  }

  async function sendImg() {
    if (!imgPath()) {
      console.error("No image path to send");
      setState("error");
      return;
    }

    setState("ready");
    setBoxes([]);
    setLastResultPath("");

    const settings = await syncSettings();

    const timerId = globalThis.setTimeout(() => {
      setState("long");
    }, settings.timeout * 1000);

    try {
      const result = await runInference(imgPath(), {
        devicePreference: settings.inferenceDevice,
        saveLocation: settings.saveLocation,
      });

      setDeviceUsed(result.deviceUsed);
      setLastResultPath(result.annotatedImagePath);

      if (result.detections.length > 0) {
        setBoxes(result.detections);
        setState("done");
      } else {
        setBoxes([]);
        setState("failed");
      }
    } catch (error) {
      console.error("Failed to run inference:", error);
      setState("error");
    } finally {
      globalThis.clearTimeout(timerId);
    }
  }

  return {
    img,
    boxes,
    setImg,
    handleGoBack,
    handleFindWaldo,
    handleDownloadResult,
    state,
    pickNewPicture,
    highlight,
    setHighlight,
    reloadModel,
    deviceUsed,
    lastResultPath,
    hasSaveLocation,
  };
}
