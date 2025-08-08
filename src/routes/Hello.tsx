import Button from "@/components/Buttton";
import { useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";

export default function Hello() {
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(false);

  async function handleStart() {
    setLoading(true);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const file = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: 'Waldo Challenge', extensions: ['png', 'jpeg', 'jpg'] }
        ]
      });

      if (!file) {
        console.error("No file selected");
        return;
      }
      navigate("/main", { state: { path: file } });
    } finally {
      setLoading(false);
    }
  }

  function handleInfo() {
    navigate("/about");
  }

  function handleSettings() {
    navigate("/settings");
  }

  return (
    <section class="center relative overflow-hidden min-h-screen">
      {/* Logo with top-to-center animation */}
      <img
        loading="lazy"
        src='/imgs/logo.png'
        alt="Main"
        class="fixed top-0 left-1/2 transform -translate-x-1/2 h-[45vh] z-0 animate-slideDown"
      />

      {/* Start button with scale spring + pulse */}
      <Button
        variant="primary"
        class="mt-24 text-5xl animate-scaleInAndPulse"
        onClick={handleStart}
        disabled={loading()}
      >
        {loading() ? (
          <span class="flex items-center gap-3">
            <span
              class="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            Opening...
          </span>
        ) : (
          "START!"
        )}
      </Button>

      {/* Info button from bottom-right */}
      <Button
        class="fixed aspect-square center bottom-4 right-4 rounded-full p-4 text-3xl animate-slideUp delay-[300ms]"
        variant="basic"
        onClick={handleInfo}
      >
        ℹ
      </Button>

      {/* Settings button from bottom-left */}
      <Button
        class="fixed aspect-square center bottom-4 left-4 rounded-full p-4 text-3xl animate-slideUp delay-[500ms]"
        variant="basic"
        onClick={handleSettings}
      >
        ⚙
      </Button>
    </section>
  );
}
