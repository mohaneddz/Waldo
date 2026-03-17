import { createSignal } from "solid-js";

import type { Detection } from "@/services/inference";
import type {
  ProgressStep,
  RuntimeSearchResult,
  SearchSettingsSnapshot,
} from "@/types/app";

const DEFAULT_STEPS: ProgressStep[] = [
  { key: "prepare", label: "Preparing model", status: "pending" },
  { key: "scan", label: "Scanning crowd regions", status: "pending" },
  { key: "compare", label: "Comparing detection patterns", status: "pending" },
  { key: "finalize", label: "Finalizing overlays", status: "pending" },
];

function cloneDefaultSteps(): ProgressStep[] {
  return DEFAULT_STEPS.map((step) => ({ ...step }));
}

const [selectedImagePath, setSelectedImagePathSignal] = createSignal("");
const [searchSettings, setSearchSettingsSignal] =
  createSignal<SearchSettingsSnapshot | null>(null);
const [runtimeResult, setRuntimeResultSignal] =
  createSignal<RuntimeSearchResult | null>(null);
const [isProcessing, setIsProcessingSignal] = createSignal(false);
const [progressPercent, setProgressPercentSignal] = createSignal(0);
const [progressMessage, setProgressMessageSignal] = createSignal("Ready");
const [progressDetail, setProgressDetailSignal] = createSignal("");
const [progressSteps, setProgressStepsSignal] = createSignal<ProgressStep[]>(
  cloneDefaultSteps(),
);
const [lastError, setLastErrorSignal] = createSignal("");

function resetProgressSteps() {
  setProgressStepsSignal(cloneDefaultSteps());
}

export function getSelectedImagePath() {
  return selectedImagePath;
}

export function setSelectedImagePath(path: string) {
  setSelectedImagePathSignal(path);
}

export function getSearchSettings() {
  return searchSettings;
}

export function setSearchSettings(settings: SearchSettingsSnapshot | null) {
  setSearchSettingsSignal(settings);
}

export function getRuntimeResult() {
  return runtimeResult;
}

export function setRuntimeResult(result: RuntimeSearchResult | null) {
  setRuntimeResultSignal(result);
}

export function getIsProcessing() {
  return isProcessing;
}

export function setIsProcessing(value: boolean) {
  setIsProcessingSignal(value);
}

export function getProgressPercent() {
  return progressPercent;
}

export function setProgressPercent(value: number) {
  setProgressPercentSignal(Math.max(0, Math.min(100, value)));
}

export function getProgressMessage() {
  return progressMessage;
}

export function setProgressMessage(message: string) {
  setProgressMessageSignal(message);
}

export function getProgressDetail() {
  return progressDetail;
}

export function setProgressDetail(detail: string) {
  setProgressDetailSignal(detail);
}

export function getProgressSteps() {
  return progressSteps;
}

export function markProgressStep(
  key: string,
  status: ProgressStep["status"],
  detail?: string,
) {
  setProgressStepsSignal((current) =>
    current.map((step) =>
      step.key === key
        ? {
            ...step,
            status,
            detail: detail ?? step.detail,
          }
        : step,
    ),
  );
}

export function resetProgress() {
  setProgressPercentSignal(0);
  setProgressMessageSignal("Ready");
  setProgressDetailSignal("");
  resetProgressSteps();
}

export function getLastError() {
  return lastError;
}

export function setLastError(message: string) {
  setLastErrorSignal(message);
}

export function clearSearchFlow() {
  setSelectedImagePathSignal("");
  setSearchSettingsSignal(null);
  setRuntimeResultSignal(null);
  setIsProcessingSignal(false);
  setLastErrorSignal("");
  resetProgress();
}

export function getTopDetectionConfidence(detections: Detection[]): number | null {
  if (detections.length === 0) {
    return null;
  }

  return detections.reduce((max, detection) =>
    Math.max(max, detection.confidence), detections[0].confidence,
  );
}
