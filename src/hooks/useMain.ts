import { useLocation } from "@solidjs/router";
import { onCleanup, onMount, createSignal } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";

import { createObjectUrlFromPath } from "@/utils/image";
import {
  loadModel,
  resetModel,
  runInference,
  type DevicePreference,
  type Detection,
  type RuntimeDevice,
} from "@/services/inference";
import { loadAppSettings } from "@/utils/settings";

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

  function handleGoBack() {
    window.history.back();
  }

  async function handleFindWaldo() {
    await sendImg();
  }

  onMount(async () => {
    const stateObj = location.state;
    if (!stateObj || typeof stateObj !== "object" || !("path" in stateObj)) {
      console.error("Invalid state object:", stateObj);
      return;
    }

    const path = (stateObj as { path: string }).path;
    const settings = await loadAppSettings();
    setTimeout(settings.timeout);
    setInferenceDevice(settings.inferenceDevice);

    await loadImage(path);
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
    const settings = await loadAppSettings();
    setTimeout(settings.timeout);
    setInferenceDevice(settings.inferenceDevice);
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

    const settings = await loadAppSettings();
    setTimeout(settings.timeout);
    setInferenceDevice(settings.inferenceDevice);

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
    state,
    pickNewPicture,
    highlight,
    setHighlight,
    reloadModel,
    deviceUsed,
    lastResultPath,
  };
}
