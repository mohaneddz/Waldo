import type { Detection, DevicePreference, RuntimeDevice } from "@/services/inference";

export type SearchOutcome = "found" | "not_found" | "error";

export interface SearchSettingsSnapshot {
  confidenceThreshold: number;
  timeout: number;
  inferenceDevice: DevicePreference;
  saveLocation: string;
}

export interface SearchSession {
  id: string;
  sourcePath: string;
  sourceName: string;
  timestamp: string;
  outcome: SearchOutcome;
  detectionsCount: number;
  topConfidence: number | null;
  outputPath: string;
  deviceUsed: RuntimeDevice | null;
  settings: SearchSettingsSnapshot;
  errorMessage?: string;
}

export interface DownloadItem {
  id: string;
  sessionId: string;
  savedPath: string;
  createdAt: string;
  exists: boolean;
}

export interface DiagnosticSnapshot {
  id: string;
  timestamp: string;
  gpuAvailable: boolean;
  modelLoaded: boolean;
  deviceUsed: RuntimeDevice | null;
  saveLocationValid: boolean;
  lastError: string;
}

export interface RuntimeSearchResult {
  sessionId: string;
  sourcePath: string;
  sourceName: string;
  detections: Detection[];
  deviceUsed: RuntimeDevice | null;
  outcome: SearchOutcome;
  outputPath: string;
  settings: SearchSettingsSnapshot;
  startedAt: string;
  completedAt: string;
  errorMessage?: string;
}

export type ProgressStepStatus = "pending" | "active" | "done" | "error";

export interface ProgressStep {
  key: string;
  label: string;
  status: ProgressStepStatus;
  detail?: string;
}
