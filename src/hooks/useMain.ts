import { useLocation } from '@solidjs/router';
import { onMount, createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getStoreValue } from '@/utils/store';

// Detection type
interface Coord {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export default function useMain() {
  const location = useLocation();
  const [img, setImg] = createSignal<string>('');
  const [imgPath, setImgPath] = createSignal<string>('');
  const [boxes, setBoxes] = createSignal<Coord[]>([]);
  const [state, setState] = createSignal<string>('ready');
  const [highlight, setHighlight] = createSignal(false);
  const [timeout, setTimeout] = createSignal(10);

  const INFER_URL = 'http://localhost:8000/infer';

  async function ensureServer() {
    try {
      const running = await invoke<boolean>('is_server_running');
      if (!running) {
        await invoke('launch_backend');
      }
    } catch {
      // best effort; proceed to request
    }
  }

  async function inferOnce(ms: number) {
    const controller = new AbortController();
    const timerId = globalThis.setTimeout(() => {
      controller.abort();
      setState('long'); // show that it's taking long
    }, ms);

    try {
      const response = await fetch(INFER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: imgPath() }),
        signal: controller.signal,
      });
      return response;
    } finally {
      globalThis.clearTimeout(timerId);
    }
  }

  async function restartServer() {
    try {
      await invoke('restart_server');
      console.log('Server restarted successfully');
    } catch (error) {
      console.error('Failed to restart server:', error);
    }
  }
  function handleGoBack() {
    window.history.back();
  }

  function handleFindWaldo() {
    sendImg();
    console.log('Finding Waldo...');
  }

  onMount(async () => {
    const stateObj = location.state;
    if (!stateObj || typeof stateObj !== 'object' || !('path' in stateObj)) {
      console.error('Invalid state object:', stateObj);
      return;
    }
    const path = (stateObj as { path: string }).path;
    const timeoutValue = await getStoreValue('timeout');
    if (typeof timeoutValue === 'number') {
      setTimeout(timeoutValue);
    }
    await loadImage(path);
  });

  async function loadImage(path: string) {
    setImgPath(path);
    const data = await invoke('read_img', { path });
    if (typeof data === 'string') setImg(data);
    setBoxes([]);
    setState('ready');
  }

  async function pickNewPicture() {
    const file = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpeg', 'jpg'] }],
    });
    if (!file || Array.isArray(file)) return;
    await loadImage(file);
    setHighlight(false);
  }

  async function sendImg() {
    if (!imgPath()) {
      console.error('No image path to send');
      setState('error');
      return;
    }

    await ensureServer();

    let ms = (timeout() ?? 10) * 1000;
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      try {
        const response = await inferOnce(ms);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();

        if (data && Array.isArray(data.detections)) {
          if (data.detections.length > 0) {
            setBoxes(data.detections as Coord[]);
            setState('done');
          } else {
            console.warn('No detections found');
            setBoxes([]);
            setState('failed');
          }
        } else {
          console.error('Empty or invalid response from server');
          setState('error');
        }
        return; // success, stop retrying
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.warn(`Request aborted due to timeout (attempt ${attempt + 1})`);
          // On first timeout, try restarting the server and retry once with a longer timeout
          attempt += 1;
          if (attempt < maxAttempts) {
            try {
              await invoke('restart_server');
            } catch {
              // ignore; we'll retry anyway
            }
            ms = Math.min(ms * 2, 600_000); // cap at 10 minutes
            continue;
          }
          // After final timeout, keep 'long' state set earlier and stop
          return;
        }

        console.error(`Failed to send image (attempt ${attempt + 1}):`, err);
        attempt += 1;
        if (attempt < maxAttempts) {
          try {
            await invoke('restart_server');
          } catch {
            // ignore and retry
          }
          continue;
        }
        setState('error');
        return;
      }
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
    restartServer,
  };
}
