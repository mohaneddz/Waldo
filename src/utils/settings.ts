import {
  BaseDirectory,
  appDataDir,
  appLocalDataDir,
  desktopDir,
  documentDir,
  downloadDir,
  homeDir,
  pictureDir,
  publicDir,
  tempDir,
} from "@tauri-apps/api/path";

import type { DevicePreference } from "@/services/inference";
import { getStoreValue, saveStore, setStoreValue } from "@/utils/store";

export interface AppSettings {
  autoStart: boolean;
  timeout: number;
  saveLocation: string;
  inferenceDevice: DevicePreference;
}

export interface SupportedSaveLocation {
  absolutePath: string;
  baseDir: BaseDirectory;
  label: string;
  relativePath: string;
}

export const DEFAULT_TIMEOUT_SECONDS = 30;
export const MIN_TIMEOUT_SECONDS = 1;
export const MAX_TIMEOUT_SECONDS = 600;

const SETTINGS_KEYS = {
  autoStart: "autostart",
  inferenceDevice: "inferenceDevice",
  saveLocation: "saveLocation",
  timeout: "timeout",
} as const;

const SUPPORTED_SAVE_LOCATIONS = [
  { label: "Downloads", baseDir: BaseDirectory.Download, getPath: downloadDir },
  { label: "Documents", baseDir: BaseDirectory.Document, getPath: documentDir },
  { label: "Desktop", baseDir: BaseDirectory.Desktop, getPath: desktopDir },
  { label: "Pictures", baseDir: BaseDirectory.Picture, getPath: pictureDir },
  { label: "Public", baseDir: BaseDirectory.Public, getPath: publicDir },
  { label: "Home", baseDir: BaseDirectory.Home, getPath: homeDir },
  { label: "Temp", baseDir: BaseDirectory.Temp, getPath: tempDir },
  { label: "App Data", baseDir: BaseDirectory.AppData, getPath: appDataDir },
  {
    label: "App Local Data",
    baseDir: BaseDirectory.AppLocalData,
    getPath: appLocalDataDir,
  },
] as const;

function normalizePathForComparison(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function sanitizeInferenceDevice(value: unknown): DevicePreference {
  return value === "cpu" || value === "gpu" || value === "auto" ? value : "auto";
}

function sanitizeTimeout(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_SECONDS;
  }

  return Math.min(
    MAX_TIMEOUT_SECONDS,
    Math.max(MIN_TIMEOUT_SECONDS, Math.round(value)),
  );
}

export async function getDefaultSaveLocation(): Promise<string> {
  return await downloadDir();
}

export async function resolveSupportedSaveLocation(
  path: string,
): Promise<SupportedSaveLocation | null> {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  const comparablePath = normalizePathForComparison(trimmedPath);

  for (const candidate of SUPPORTED_SAVE_LOCATIONS) {
    const absolutePath = await candidate.getPath();
    const comparableBasePath = normalizePathForComparison(absolutePath);

    if (comparablePath === comparableBasePath) {
      return {
        absolutePath,
        baseDir: candidate.baseDir,
        label: candidate.label,
        relativePath: "",
      };
    }

    if (comparablePath.startsWith(`${comparableBasePath}/`)) {
      const relativePath = trimmedPath
        .replace(/\\/g, "/")
        .slice(absolutePath.replace(/\\/g, "/").length)
        .replace(/^\/+/, "");

      return {
        absolutePath,
        baseDir: candidate.baseDir,
        label: candidate.label,
        relativePath,
      };
    }
  }

  return null;
}

export async function validateSaveLocation(
  path: string,
): Promise<{ error: string | null; value: string }> {
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    return {
      error: null,
      value: await getDefaultSaveLocation(),
    };
  }

  const supportedLocation = await resolveSupportedSaveLocation(trimmedPath);
  if (supportedLocation) {
    return {
      error: null,
      value: trimmedPath,
    };
  }

  return {
    error:
      "Save location must be inside one of the app-safe folders: Downloads, Documents, Desktop, Pictures, Public, Home, Temp, App Data, or App Local Data.",
    value: trimmedPath,
  };
}

export async function loadAppSettings(): Promise<AppSettings> {
  const defaultSaveLocation = await getDefaultSaveLocation();

  const autoStart = await getStoreValue<boolean>(SETTINGS_KEYS.autoStart);
  const timeout = await getStoreValue<number>(SETTINGS_KEYS.timeout);
  const saveLocation = await getStoreValue<string>(SETTINGS_KEYS.saveLocation);
  const inferenceDevice = await getStoreValue<DevicePreference>(
    SETTINGS_KEYS.inferenceDevice,
  );

  const validatedSaveLocation = await validateSaveLocation(saveLocation ?? "");

  return {
    autoStart: typeof autoStart === "boolean" ? autoStart : false,
    timeout: sanitizeTimeout(timeout),
    saveLocation: validatedSaveLocation.error ? defaultSaveLocation : validatedSaveLocation.value,
    inferenceDevice: sanitizeInferenceDevice(inferenceDevice),
  };
}

export async function hasConfiguredSaveLocation(): Promise<boolean> {
  const saveLocation = await getStoreValue<string>(SETTINGS_KEYS.saveLocation);
  return typeof saveLocation === "string" && saveLocation.trim().length > 0;
}

export async function saveAppSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  const validatedSaveLocation = await validateSaveLocation(settings.saveLocation);
  if (validatedSaveLocation.error) {
    throw new Error(validatedSaveLocation.error);
  }

  const sanitizedSettings: AppSettings = {
    autoStart: settings.autoStart,
    timeout: sanitizeTimeout(settings.timeout),
    saveLocation: validatedSaveLocation.value,
    inferenceDevice: sanitizeInferenceDevice(settings.inferenceDevice),
  };

  await setStoreValue(SETTINGS_KEYS.autoStart, sanitizedSettings.autoStart);
  await setStoreValue(SETTINGS_KEYS.timeout, sanitizedSettings.timeout);
  await setStoreValue(SETTINGS_KEYS.saveLocation, sanitizedSettings.saveLocation);
  await setStoreValue(
    SETTINGS_KEYS.inferenceDevice,
    sanitizedSettings.inferenceDevice,
  );
  await saveStore();

  return sanitizedSettings;
}
