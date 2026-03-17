import { createSignal, onMount, Show } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import Minus from 'lucide-solid/icons/minus';
import Maximize2 from 'lucide-solid/icons/maximize-2';
import Minimize2 from 'lucide-solid/icons/minimize-2';
import X from 'lucide-solid/icons/x';

export default function Titlebar() {
  let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
  try {
    appWindow = getCurrentWindow();
  } catch {
    appWindow = null;
  }

  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isMaximized, setIsMaximized] = createSignal(false);

  const toggleFullscreen = async () => {
    if (!appWindow) {
      return;
    }
    const fullscreen = await appWindow.isFullscreen();
    const maximized = await appWindow.isMaximized();

    if (!fullscreen && maximized) {
      await appWindow.unmaximize();
      setTimeout(() => appWindow.setFullscreen(true), 50);
    } else {
      appWindow.setFullscreen(!fullscreen);
    }
  };

  // Sync state on mount + listen to window events
  onMount(async () => {
    if (!appWindow) {
      return;
    }
    setIsFullscreen(await appWindow.isFullscreen());
    setIsMaximized(await appWindow.isMaximized());

    await listen('tauri://fullscreen', () => setIsFullscreen(true));
    await listen('tauri://enter-fullscreen', () => setIsFullscreen(true));
    await listen('tauri://exit-fullscreen', () => setIsFullscreen(false));

    await listen('tauri://maximize', () => setIsMaximized(true));
    await listen('tauri://unmaximize', () => setIsMaximized(false));
    // await listen('tauri://minimize', () => console.log('Window minimized'));

    await listen('tauri://resize', async () => {
      const max = await appWindow.isMaximized();
      setIsMaximized(max);
    });
  });

  // F11 toggle
  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  if (!appWindow) {
    return <div class="titlebar" />;
  }

  return (
    <div data-tauri-drag-region class="titlebar">
      <Show when={!isFullscreen()}>
        <button onClick={() => appWindow.minimize()} class="titlebar-button" id="titlebar-minimize">
          <Minus size={14} />
        </button>

        <button
          onClick={async () => {
            await appWindow.toggleMaximize();
            const max = await appWindow.isMaximized();
            setIsMaximized(max);
          }}
          class="titlebar-button"
          id="titlebar-maximize"
        >
          <Show when={!isMaximized()}>
            <Maximize2 size={13} />
          </Show>
          <Show when={isMaximized()}>
            <Minimize2 size={13} />
          </Show>
        </button>

        <button onClick={() => appWindow.close()} class="titlebar-button" id="titlebar-close">
          <X size={14} />
        </button>
      </Show>
    </div>
  );
}
