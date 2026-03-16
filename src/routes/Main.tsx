import Button from "@/components/Buttton";
import useMain from "@/hooks/useMain";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import Image from "@/components/Image";

import RotateCcw from "lucide-solid/icons/rotate-ccw";
import FilePlus from "lucide-solid/icons/file-plus";
import Download from "lucide-solid/icons/download";

export default function Main() {
  const {
    img,
    handleGoBack,
    handleFindWaldo,
    handleDownloadResult,
    boxes,
    state,
    highlight,
    setHighlight,
    reloadModel,
    pickNewPicture,
    deviceUsed,
    lastResultPath,
    hasSaveLocation,
  } = useMain();

  const [isFinding, setIsFinding] = createSignal(false);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [toastMessage, setToastMessage] = createSignal("");
  let toastTimerId: number | undefined;

  const onFind = async () => {
    setIsFinding(true);
    try {
      await handleFindWaldo();
    } catch (_) {
    } finally {
      setIsFinding(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerId) {
      window.clearTimeout(toastTimerId);
    }
    toastTimerId = window.setTimeout(() => {
      setToastMessage("");
    }, 2500);
  };

  const onDownload = async () => {
    setIsDownloading(true);
    try {
      const savedPath = await handleDownloadResult();
      showToast(`Saved to ${savedPath}`);
    } catch (error) {
      console.error("Failed to save result:", error);
      showToast("Failed to save image.");
    } finally {
      setIsDownloading(false);
    }
  };

  createEffect(() => {
    if (["done", "failed", "error", "duh"].includes(state())) {
      setIsFinding(false);
    }
  });

  onCleanup(() => {
    if (toastTimerId) {
      window.clearTimeout(toastTimerId);
    }
  });

  return (
    <section class="overflow-hidden center">
      <Show when={toastMessage()}>
        <div class="fixed top-5 left-1/2 -translate-x-1/2 z-40 rounded-md border border-white/20 bg-black/75 px-4 py-2 text-sm text-white shadow-lg">
          {toastMessage()}
        </div>
      </Show>
      <div class="h-[80%] w-[80%] m-auto flex items-center justify-center bg-secondary rounded-md border flex-col relative">
        <div class="relative w-[90%] h-[70%] overflow-hidden">
          <div class="relative w-full h-full flex items-center justify-center border-2 bg-secondary-dark">
            {/* Loading overlay while finding */}
            <Show when={isFinding()}>
              <div class="absolute inset-0 z-20 bg-black/40 center flex-col gap-3 text-white">
                <span
                  class="inline-block w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span class="text-sm opacity-90">Finding Waldo...</span>
              </div>
            </Show>

            <Image
              src={img()}
              class="w-full h-full rounded "
              boxes={highlight() ? boxes() : []}
              highlight={highlight()}
            />
            <Show when={["done", "failed"].includes(state()) && hasSaveLocation()}>
              <button
                class="absolute top-3 left-3 z-10 px-3 py-1 text-xs rounded bg-black/60 text-white border border-white/20 hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={onDownload}
                disabled={isDownloading()}
              >
                <Download size={14} />
                {isDownloading() ? "Saving..." : "Download"}
              </button>
            </Show>
            <Show when={state() === "done" && state() !== "duh"}>
              <button
                class="absolute top-3 right-3 z-10 px-3 py-1 text-xs rounded bg-black/60 text-white border border-white/20 hover:bg-black/70"
                onClick={() => setHighlight(!highlight())}
              >
                {highlight() ? "Hide Result" : "Show Results"}
              </button>
            </Show>
          </div>
        </div>

        <div class="center gap-4 mt-8">
          <Button variant="ghost" onClick={handleGoBack} disabled={isFinding()}>
            Go Back
          </Button>
          <Button variant="secondary" onClick={onFind} disabled={isFinding()}>
            {isFinding() ? (
              <span class="flex items-center gap-2">
                <span
                  class="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                Processing...
              </span>
            ) : (
              "Find Waldo"
            )}
          </Button>
        </div>

        <Button
          variant="basic"
          class="fixed bottom-4 p-2 left-4 rounded-full"
          onClick={pickNewPicture}
          title="Pick a new image"
        >
          <FilePlus />
        </Button>
        <Button
          variant="basic"
          class="fixed bottom-4 p-2 right-4 rounded-full"
          onClick={reloadModel}
          title="Reload model"
        >
          <RotateCcw />
        </Button>

        <Show
          when={
            state() === "done" ||
            state() === "failed" ||
            state() === "error" ||
            state() === "duh"
          }
          fallback={
            <div class="center text-center bottom-4 text-white mt-4 flex flex-col gap-2">
              <p class="text-lg font-semibold flex items-center gap-2">
                  {
                    isFinding() ? (
                      <>
                        <span
                          class="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                          aria-hidden="true"
                        />
                        Finding Waldo...
                      </>
                    ) : (
                      "Start finding Waldo!"
                    )
                  }
              </p>
            </div>
          }
        >
          <div class="center text-center bottom-4 text-white mt-4 flex flex-col gap-2">
            <p class="text-lg font-semibold">
              {state() === "done"
                ? "Waldo was Found!"
                : state() === "failed"
                  ? "No Waldo was Found!"
                  : state() === "error"
                    ? "Error, inference failed!"
                    : "Solve it yourself!"}
            </p>
            <Show when={deviceUsed()}>
              <p class="text-sm opacity-80 mt-1">
                Device: {deviceUsed() === "webgpu" ? "GPU" : "CPU"}
              </p>
            </Show>
            <Show when={lastResultPath()}>
              <p class="text-xs opacity-70 mt-1">Saved: {lastResultPath()}</p>
            </Show>
          </div>
        </Show>

      </div>
    </section>
  );
};
