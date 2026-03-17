import { useNavigate } from "@solidjs/router";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import Wrench from "lucide-solid/icons/wrench";

import Button from "@/components/Buttton";
import { resetModel } from "@/services/inference";
import {
  getLastError,
  getRuntimeResult,
  getSearchSettings,
  getSelectedImagePath,
} from "@/state/searchState";

export default function ResultsNotFoundRoute() {
  const navigate = useNavigate();
  const runtimeResult = getRuntimeResult();
  const searchSettings = getSearchSettings();
  const selectedImagePath = getSelectedImagePath();
  const lastError = getLastError();

  const hasRetryContext = () => Boolean(selectedImagePath() && searchSettings());

  return (
    <section class="page notfound-page">
      <header class="page-header">
        <h1>Waldo Not Found</h1>
      </header>

      <div class="notfound-layout">
        <div class="notfound-main vintage-paper">
          <p class="notfound-lead">
            {runtimeResult()?.outcome === "error"
              ? "Search failed due to a runtime issue."
              : "Waldo wasn’t confidently detected in this image."}
          </p>

          {lastError() ? (
            <p class="error-text">
              <AlertTriangle size={16} /> {lastError()}
            </p>
          ) : null}

          <ol>
            <li>Try a higher resolution image.</li>
            <li>Lower confidence threshold slightly in settings.</li>
            <li>Increase timeout for large scene scans.</li>
            <li>Run diagnostics if model/runtime appears unstable.</li>
          </ol>
        </div>

        <div class="notfound-actions note-paper">
          <Button
            variant="secondary"
            onClick={() => navigate("/search/new")}
            disabled={!selectedImagePath()}
          >
            <RefreshCw size={16} /> Adjust and Retry
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate("/search/processing")}
            disabled={!hasRetryContext()}
          >
            Retry Search
          </Button>
          <Button variant="ghost" onClick={() => navigate("/settings")}>
            <Wrench size={16} /> Open Settings
          </Button>
          <Button variant="ghost" onClick={() => navigate("/diagnostics")}>
            Run Diagnostics
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await resetModel();
              navigate("/diagnostics");
            }}
          >
            Restart Model Runtime
          </Button>
        </div>
      </div>
    </section>
  );
}
