import { A, useLocation } from "@solidjs/router";
import { For, createMemo, createSignal, onMount } from "solid-js";
import Home from "lucide-solid/icons/house";
import Search from "lucide-solid/icons/search";
import FileSearch from "lucide-solid/icons/file-search";
import History from "lucide-solid/icons/history";
import FolderDown from "lucide-solid/icons/folder-down";
import Settings from "lucide-solid/icons/settings";
import Stethoscope from "lucide-solid/icons/stethoscope";
import Info from "lucide-solid/icons/info";

import { loadAppSettings } from "@/utils/settings";
import {
  getIsProcessing,
  getRuntimeResult,
  getSelectedImagePath,
} from "@/state/searchState";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  matchPrefix: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, matchPrefix: "/home" },
  {
    href: "/search/new",
    label: "New Search",
    icon: Search,
    matchPrefix: "/search",
  },
  {
    href: "/results/review",
    label: "Results",
    icon: FileSearch,
    matchPrefix: "/results",
  },
  {
    href: "/history",
    label: "History",
    icon: History,
    matchPrefix: "/history",
  },
  {
    href: "/downloads",
    label: "Downloads",
    icon: FolderDown,
    matchPrefix: "/downloads",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    matchPrefix: "/settings",
  },
  {
    href: "/diagnostics",
    label: "Diagnostics",
    icon: Stethoscope,
    matchPrefix: "/diagnostics",
  },
  { href: "/about", label: "About", icon: Info, matchPrefix: "/about" },
];

export default function AppShell(props: { children: any }) {
  const location = useLocation();
  const [saveLocationLabel, setSaveLocationLabel] = createSignal("Not configured");

  const isProcessing = getIsProcessing();
  const runtimeResult = getRuntimeResult();
  const selectedImagePath = getSelectedImagePath();

  const modelStatus = createMemo(() => {
    if (isProcessing()) {
      return "Searching";
    }

    if (runtimeResult()) {
      return "Ready";
    }

    return "Idle";
  });

  onMount(() => {
    void (async () => {
      const settings = await loadAppSettings();
      setSaveLocationLabel(settings.saveLocation || "Not configured");
    })();
  });

  return (
    <main class="waldo-shell">
      <aside class="waldo-sidebar frame-shell">
        <header class="sidebar-header">
          <img src="/vintage/header-badge.png" alt="Waldo Finder" class="sidebar-logo" />
        </header>

        <nav class="sidebar-nav">
          <For each={NAV_ITEMS}>
            {(item) => {
              const Icon = item.icon;
              const active = () =>
                location.pathname === item.href ||
                location.pathname.startsWith(item.matchPrefix);

              return (
                <A
                  href={item.href}
                  class={`sidebar-link ${active() ? "active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </A>
              );
            }}
          </For>
        </nav>
      </aside>

      <section class="waldo-workspace">
        <div class="waldo-book frame-shell">
          <div class="waldo-page-surface">{props.children}</div>
        </div>

        <footer class="waldo-status vintage-paper">
          <span>Server: Connected</span>
          <span>Model: {modelStatus()}</span>
          <span>
            Current image:{" "}
            {selectedImagePath()
              ? selectedImagePath().split(/[/\\]/).at(-1)
              : "None"}
          </span>
          <span>Save folder: {saveLocationLabel()}</span>
        </footer>
      </section>
    </main>
  );
}
