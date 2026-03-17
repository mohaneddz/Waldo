import { readFile } from "@tauri-apps/plugin-fs";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  bmp: "image/bmp",
};

function getMimeType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export async function createObjectUrlFromPath(path: string): Promise<string> {
  if (path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const bytes = await readFile(path);
  const blob = new Blob([bytes], { type: getMimeType(path) });
  return URL.createObjectURL(blob);
}

export async function loadImageFromPath(path: string): Promise<{
  image: HTMLImageElement;
  objectUrl: string;
}> {
  const objectUrl = await createObjectUrlFromPath(path);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    element.src = objectUrl;
  });

  return { image, objectUrl };
}
