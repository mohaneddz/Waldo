import { onCleanup, onMount, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { getStoreValue } from "@/utils/store";
import { invoke } from "@tauri-apps/api/core";

export default function Loading() {
  const [dots, setDots] = createSignal(".");
  const navigate = useNavigate();

  onMount(() => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const isServerUp = async (): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1500);
        const res = await fetch("http://127.0.0.1:8000/", {
          method: "GET",
          signal: controller.signal,
          headers: { "cache-control": "no-cache" },
        });
        clearTimeout(id);
        if (!res.ok) return false;
        const json = await res.json().catch(() => null);
        return (
          json &&
          typeof json.message === "string" &&
          json.message === "Welcome to the FastAPI server!"
        );
      } catch (_) {
        return false;
      }
    };

    // --- FIX: Start the backend without blocking onMount ---
    const startBackend = async () => {
      try {
        const autostart = await getStoreValue("autostart");
        if (autostart) {
          const tryStart = async (): Promise<boolean> => {
            const ok = await invoke<boolean>("restart_server").catch(() => false);
            if (!ok) {
              await sleep(2000);
              return tryStart();
            }
            return true;
          };
          await tryStart();
        }
      } catch (error) {
        console.error("Failed to launch backend:", error);
      }
    };

    startBackend(); // This is now non-blocking

    // animate dots
    let count = 0;
    const dotInterval = setInterval(() => {
      count = (count % 3) + 1;
      setDots(".".repeat(count));
    }, 500);

    // poll server until it is up
    const checkInterval = setInterval(async () => {
      const up = await isServerUp();
      if (up) {
        clearInterval(dotInterval);
        clearInterval(checkInterval);
        navigate("/hello");
      }
    }, 750);

    onCleanup(() => {
      clearInterval(dotInterval);
      clearInterval(checkInterval);
    });
  });

  return (
    <section class="h-screen w-screen flex items-center justify-center text-center">
      <h1 class="text-7xl font-bold">
        Loading
        <br />
        {dots()}
      </h1>
    </section>
  );
}