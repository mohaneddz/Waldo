import { onCleanup, onMount, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { loadModel } from "@/services/inference";
import { loadAppSettings } from "@/utils/settings";

export default function Loading() {
  const [dots, setDots] = createSignal(".");
  const [status, setStatus] = createSignal("Preparing app");
  const navigate = useNavigate();

  onMount(() => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const prepareApp = async () => {
      try {
        const settings = await loadAppSettings();

        if (settings.autoStart) {
          setStatus("Preloading model");
          await loadModel(settings.inferenceDevice);
        }
      } catch (error) {
        console.error("Failed to preload model:", error);
      } finally {
        setStatus("Launching");
        await sleep(350);
        navigate("/hello");
      }
    };

    void prepareApp();

    let count = 0;
    const dotInterval = setInterval(() => {
      count = (count % 3) + 1;
      setDots(".".repeat(count));
    }, 500);

    onCleanup(() => {
      clearInterval(dotInterval);
    });
  });

  return (
    <section class="h-screen w-screen flex items-center justify-center text-center">
      <div>
        <h1 class="text-7xl font-bold">
          Loading
          <br />
          {dots()}
        </h1>
        <p class="mt-10 text-lg opacity-80">{status()}</p>
      </div>
    </section>
  );
}
