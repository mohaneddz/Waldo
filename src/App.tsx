import { Router, Route } from "@solidjs/router";

import Titlebar from "@/layout/Titlebar";
import { routes } from "@/routes/Routes";

function App() {


  return (
    <Router
      root={(props) => (
        <section class="app-root">
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
