import { Router, Route } from "@solidjs/router";
import { getStoreValue } from "./utils/store";
import { onMount } from "solid-js";

import Titlebar from "@/layout/Titlebar";
import { routes } from "@/routes/Routes";
import { invoke } from "@tauri-apps/api/core";

function App() {
  // Backend launch without blocking render
  onMount(() => {
    getStoreValue("autostart").then((autostart) => {
      if (autostart) {
        invoke('launch_backend')
          .then(() => console.log("Backend launched successfully"))
          .catch((error) => console.error("Failed to launch backend:", error));
      } else {
        console.log("Autostart is disabled, backend will not be launched.");
      }
    });
  });

  return (
    <Router
      root={(props) => (
        <section class="h-screen w-screen overflow-hidden flex">
          <Titlebar />
          {props.children}
        </section>
      )}
    >
      {routes.map(({ path, component: C, children }) => (
        <Route path={path} component={C}>
          {children?.map(({ path, component }) => (
            <Route path={path} component={component} />
          ))}
        </Route>
      ))}
    </Router>
  );
}

export default App;
