import * as ort from "onnxruntime-web";
import {
  downloadDir,
  join,
} from "@tauri-apps/api/path";
import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import ortWasmSimdThreadedJsepWasmUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url";
import ortWasmSimdThreadedJsepMjsUrl from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url";

import { loadImageFromPath } from "@/utils/image";
import { resolveSupportedSaveLocation } from "@/utils/settings";

export type DevicePreference = "auto" | "gpu" | "cpu";
export type RuntimeDevice = "webgpu" | "cpu";

export interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface SessionState {
  session: ort.InferenceSession;
  deviceUsed: RuntimeDevice;
}

interface TileMeta {
  scale: number;
  padX: number;
  padY: number;
  tileWidth: number;
  tileHeight: number;
  offsetX: number;
  offsetY: number;
}

interface RunInferenceOptions {
  devicePreference: DevicePreference;
  saveLocation?: string | null;
}

export interface InferenceResult {
  detections: Detection[];
  annotatedImagePath: string;
  deviceUsed: RuntimeDevice;
}

const MODEL_URL = "/best.onnx";
const INPUT_SIZE = 960;
const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;
const CLASS_NAMES = ["Odlaw", "Waldo", "Wilma", "Wizard", "woof"];
export const AUTO_SAVE = false;

let sessionState: SessionState | null = null;
let sessionPromise: Promise<SessionState> | null = null;
let modelBytesPromise: Promise<Uint8Array> | null = null;

const supportsCrossOriginIsolated =
  typeof self !== "undefined" && self.crossOriginIsolated;

ort.env.wasm.proxy = false;
ort.env.wasm.simd = true;
ort.env.wasm.numThreads = supportsCrossOriginIsolated
  ? Math.max(1, Math.min(4, navigator.hardwareConcurrency ?? 2))
  : 1;
ort.env.wasm.wasmPaths = {
  mjs: ortWasmSimdThreadedJsepMjsUrl,
  wasm: ortWasmSimdThreadedJsepWasmUrl,
};

function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function createSession(
  executionProviders: ort.InferenceSession.SessionOptions["executionProviders"],
  deviceUsed: RuntimeDevice,
): Promise<SessionState> {
  const modelBytes = await loadModelBytes();
  let session: ort.InferenceSession;
  try {
    session = await ort.InferenceSession.create(modelBytes, {
      executionProviders,
      graphOptimizationLevel: "all",
    });
  } catch (error) {
    const message = String(error);
    if (message.toLowerCase().includes("protobuf parsing failed")) {
      throw new Error(
        "Model parsing failed. public/best.onnx is invalid or incompatible. Re-export ONNX and replace public/best.onnx.",
      );
    }
    throw error;
  }

  return { session, deviceUsed };
}

async function loadModelBytes(): Promise<Uint8Array> {
  if (!modelBytesPromise) {
    modelBytesPromise = (async () => {
      const response = await fetch(MODEL_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch model at "${MODEL_URL}" (HTTP ${response.status}).`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error(
          `Model fetch returned HTML instead of ONNX bytes. Verify "${MODEL_URL}" exists in public assets.`,
        );
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) {
        throw new Error(`Model file at "${MODEL_URL}" is empty.`);
      }

      return bytes;
    })().catch((error) => {
      modelBytesPromise = null;
      throw error;
    });
  }

  return modelBytesPromise;
}

async function buildSessionState(
  preference: DevicePreference,
): Promise<SessionState> {
  if (preference === "cpu") {
    return createSession(["wasm"], "cpu");
  }

  if (!hasWebGpu()) {
    if (preference === "gpu") {
      throw new Error("GPU inference was requested, but WebGPU is unavailable.");
    }
    return createSession(["wasm"], "cpu");
  }

  try {
    return await createSession(["webgpu"], "webgpu");
  } catch (error) {
    if (preference === "gpu") {
      throw new Error(
        `GPU inference was requested, but model initialization failed: ${String(error)}`,
      );
    }
    return createSession(["wasm"], "cpu");
  }
}

async function ensureSession(
  preference: DevicePreference,
): Promise<SessionState> {
  if (sessionState) {
    if (preference === "cpu" && sessionState.deviceUsed !== "cpu") {
      await resetModel();
    } else {
      return sessionState;
    }
  }

  if (!sessionPromise) {
    sessionPromise = buildSessionState(preference)
      .then((state) => {
        sessionState = state;
        return state;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }

  return sessionPromise;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function joinRelativeFsPath(directory: string, fileName: string): string {
  return directory.length > 0 ? `${directory}/${fileName}` : fileName;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function prepareTileTensor(
  image: CanvasImageSource,
  tileWidth: number,
  tileHeight: number,
  offsetX: number,
  offsetY: number,
): { tensor: ort.Tensor; meta: TileMeta } {
  const letterboxCanvas = createCanvas(INPUT_SIZE, INPUT_SIZE);
  const letterboxContext = letterboxCanvas.getContext("2d");

  if (!letterboxContext) {
    throw new Error("Failed to create a canvas context for preprocessing.");
  }

  letterboxContext.fillStyle = "black";
  letterboxContext.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

  const scale = Math.min(INPUT_SIZE / tileWidth, INPUT_SIZE / tileHeight);
  const resizedWidth = Math.max(1, Math.round(tileWidth * scale));
  const resizedHeight = Math.max(1, Math.round(tileHeight * scale));
  const padX = Math.floor((INPUT_SIZE - resizedWidth) / 2);
  const padY = Math.floor((INPUT_SIZE - resizedHeight) / 2);

  letterboxContext.drawImage(
    image,
    0,
    0,
    tileWidth,
    tileHeight,
    padX,
    padY,
    resizedWidth,
    resizedHeight,
  );

  const { data } = letterboxContext.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const floatData = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
  const planeSize = INPUT_SIZE * INPUT_SIZE;

  for (let pixelIndex = 0; pixelIndex < planeSize; pixelIndex += 1) {
    const sourceIndex = pixelIndex * 4;
    floatData[pixelIndex] = data[sourceIndex] / 255;
    floatData[planeSize + pixelIndex] = data[sourceIndex + 1] / 255;
    floatData[planeSize * 2 + pixelIndex] = data[sourceIndex + 2] / 255;
  }

  return {
    tensor: new ort.Tensor("float32", floatData, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    meta: {
      scale,
      padX,
      padY,
      tileWidth,
      tileHeight,
      offsetX,
      offsetY,
    },
  };
}

function intersectionOverUnion(
  a: Detection["bbox"],
  b: Detection["bbox"],
): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);

  const intersectionWidth = Math.max(0, x2 - x1);
  const intersectionHeight = Math.max(0, y2 - y1);
  const intersection = intersectionWidth * intersectionHeight;

  if (intersection <= 0) {
    return 0;
  }

  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  return intersection / (areaA + areaB - intersection);
}

function applyNms(detections: Detection[]): Detection[] {
  const byClass = new Map<string, Detection[]>();

  for (const detection of detections) {
    const bucket = byClass.get(detection.class) ?? [];
    bucket.push(detection);
    byClass.set(detection.class, bucket);
  }

  const result: Detection[] = [];

  for (const classDetections of byClass.values()) {
    const sorted = [...classDetections].sort(
      (left, right) => right.confidence - left.confidence,
    );

    while (sorted.length > 0) {
      const current = sorted.shift();
      if (!current) {
        break;
      }

      result.push(current);

      for (let index = sorted.length - 1; index >= 0; index -= 1) {
        if (intersectionOverUnion(current.bbox, sorted[index].bbox) > IOU_THRESHOLD) {
          sorted.splice(index, 1);
        }
      }
    }
  }

  return result.sort((left, right) => right.confidence - left.confidence);
}

function decodeOutput(output: Float32Array, meta: TileMeta): Detection[] {
  const stride = output.length / 9;
  const detections: Detection[] = [];

  for (let index = 0; index < stride; index += 1) {
    const centerX = output[index];
    const centerY = output[stride + index];
    const width = output[stride * 2 + index];
    const height = output[stride * 3 + index];

    let classId = -1;
    let bestScore = 0;

    for (let classIndex = 0; classIndex < CLASS_NAMES.length; classIndex += 1) {
      const score = output[stride * (4 + classIndex) + index];
      if (score > bestScore) {
        bestScore = score;
        classId = classIndex;
      }
    }

    if (classId < 0 || bestScore < CONFIDENCE_THRESHOLD) {
      continue;
    }

    const x1 = (centerX - width / 2 - meta.padX) / meta.scale;
    const y1 = (centerY - height / 2 - meta.padY) / meta.scale;
    const x2 = (centerX + width / 2 - meta.padX) / meta.scale;
    const y2 = (centerY + height / 2 - meta.padY) / meta.scale;

    const mappedX1 = clamp(x1, 0, meta.tileWidth) + meta.offsetX;
    const mappedY1 = clamp(y1, 0, meta.tileHeight) + meta.offsetY;
    const mappedX2 = clamp(x2, 0, meta.tileWidth) + meta.offsetX;
    const mappedY2 = clamp(y2, 0, meta.tileHeight) + meta.offsetY;

    if (mappedX2 <= mappedX1 || mappedY2 <= mappedY1) {
      continue;
    }

    detections.push({
      class: CLASS_NAMES[classId] ?? String(classId),
      confidence: bestScore,
      bbox: [mappedX1, mappedY1, mappedX2, mappedY2],
    });
  }

  return detections;
}

async function inferTile(
  session: ort.InferenceSession,
  source: CanvasImageSource,
  tileWidth: number,
  tileHeight: number,
  offsetX: number,
  offsetY: number,
): Promise<Detection[]> {
  const { tensor, meta } = prepareTileTensor(
    source,
    tileWidth,
    tileHeight,
    offsetX,
    offsetY,
  );

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const result = await session.run({ [inputName]: tensor });
  const output = result[outputName];
  const raw = output.data;

  if (!(raw instanceof Float32Array)) {
    throw new Error("Unexpected ONNX output type.");
  }

  return decodeOutput(raw, meta);
}

async function detect(image: HTMLImageElement, session: ort.InferenceSession) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  if (Math.max(width, height) <= INPUT_SIZE) {
    return applyNms(await inferTile(session, image, width, height, 0, 0));
  }

  const detections: Detection[] = [];

  for (let top = 0; top < height; top += INPUT_SIZE) {
    for (let left = 0; left < width; left += INPUT_SIZE) {
      const tileWidth = Math.min(INPUT_SIZE, width - left);
      const tileHeight = Math.min(INPUT_SIZE, height - top);
      const tileCanvas = createCanvas(tileWidth, tileHeight);
      const tileContext = tileCanvas.getContext("2d");

      if (!tileContext) {
        throw new Error("Failed to create a canvas context for tiling.");
      }

      tileContext.drawImage(
        image,
        left,
        top,
        tileWidth,
        tileHeight,
        0,
        0,
        tileWidth,
        tileHeight,
      );

      detections.push(
        ...(await inferTile(session, tileCanvas, tileWidth, tileHeight, left, top)),
      );
    }
  }

  return applyNms(detections);
}

function colorForIndex(index: number): string {
  const colors = [
    "#ff3b30",
    "#34c759",
    "#007aff",
    "#ffcc00",
    "#ff9f0a",
    "#64d2ff",
  ];
  return colors[index % colors.length];
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (generatedBlob) => {
        if (generatedBlob) {
          resolve(generatedBlob);
          return;
        }
        reject(new Error("Failed to encode annotated image."));
      },
      "image/jpeg",
      0.92,
    );
  });

  return new Uint8Array(await blob.arrayBuffer());
}

async function saveAnnotatedResult(
  image: HTMLImageElement,
  detections: Detection[],
  saveLocation?: string | null,
): Promise<string> {
  const outputDirectory = saveLocation?.trim() || (await downloadDir());
  const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create a canvas context for result saving.");
  }

  context.drawImage(image, 0, 0);
  context.lineWidth = Math.max(2, Math.round(Math.max(canvas.width, canvas.height) / 700));
  context.font = `${Math.max(18, Math.round(Math.max(canvas.width, canvas.height) / 55))}px Arial`;
  context.textBaseline = "top";

  detections.forEach((detection, index) => {
    const [x1, y1, x2, y2] = detection.bbox;
    const color = colorForIndex(index);
    const label = `${detection.class} ${(detection.confidence * 100).toFixed(1)}%`;
    const labelWidth = context.measureText(label).width + 16;
    const labelHeight = 30;
    const textY = Math.max(0, y1 - labelHeight);

    context.strokeStyle = color;
    context.fillStyle = color;
    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
    context.fillRect(x1, textY, labelWidth, labelHeight);
    context.fillStyle = "#0b0b0b";
    context.fillText(label, x1 + 8, textY + 6);
  });

  const scopedDirectory = await resolveSupportedSaveLocation(outputDirectory);

  if (scopedDirectory) {
    if (
      scopedDirectory.relativePath.length > 0 &&
      !(await exists(scopedDirectory.relativePath, {
        baseDir: scopedDirectory.baseDir,
      }))
    ) {
      await mkdir(scopedDirectory.relativePath, {
        recursive: true,
        baseDir: scopedDirectory.baseDir,
      });
    }

    const outputPath = await join(outputDirectory, "result.jpg");
    const bytes = await canvasToJpegBytes(canvas);
    await writeFile(
      joinRelativeFsPath(scopedDirectory.relativePath, "result.jpg"),
      bytes,
      { baseDir: scopedDirectory.baseDir },
    );

    return outputPath;
  }

  if (!(await exists(outputDirectory))) {
    await mkdir(outputDirectory, { recursive: true });
  }

  const outputPath = await join(outputDirectory, "result.jpg");
  const bytes = await canvasToJpegBytes(canvas);
  await writeFile(outputPath, bytes);

  return outputPath;
}

export async function loadModel(
  devicePreference: DevicePreference,
): Promise<RuntimeDevice> {
  const state = await ensureSession(devicePreference);
  return state.deviceUsed;
}

export async function runInference(
  imagePath: string,
  options: RunInferenceOptions,
): Promise<InferenceResult> {
  const state = await ensureSession(options.devicePreference);
  const { image, objectUrl } = await loadImageFromPath(imagePath);

  try {
    const detections = await detect(image, state.session);
    const annotatedImagePath = AUTO_SAVE
      ? await saveAnnotatedResult(image, detections, options.saveLocation)
      : "";

    return {
      detections,
      annotatedImagePath,
      deviceUsed: state.deviceUsed,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function saveInferenceResult(
  imagePath: string,
  detections: Detection[],
  saveLocation?: string | null,
): Promise<string> {
  const { image, objectUrl } = await loadImageFromPath(imagePath);
  try {
    return await saveAnnotatedResult(image, detections, saveLocation);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function resetModel(): Promise<void> {
  sessionState = null;
  sessionPromise = null;
  modelBytesPromise = null;
}
