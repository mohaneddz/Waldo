import { lazy } from "solid-js";
import { Navigate } from "@solidjs/router";
import Layout from "@/layout/Layout";

export const routes = [
  {
    path: "/",
    component: (props: any) => <Layout>{props.children}</Layout>,
    children: [
      { path: "/", component: () => <Navigate href="/home" /> },
      { path: "/home", component: lazy(() => import("@/routes/Home")) },
      { path: "/search/new", component: lazy(() => import("@/routes/SearchNew")) },
      {
        path: "/search/processing",
        component: lazy(() => import("@/routes/SearchProcessing")),
      },
      {
        path: "/results/review",
        component: lazy(() => import("@/routes/ResultsReview")),
      },
      {
        path: "/results/not-found",
        component: lazy(() => import("@/routes/ResultsNotFound")),
      },
      { path: "/history", component: lazy(() => import("@/routes/History")) },
      { path: "/downloads", component: lazy(() => import("@/routes/Downloads")) },
      { path: "/settings", component: lazy(() => import("@/routes/Settings")) },
      {
        path: "/diagnostics",
        component: lazy(() => import("@/routes/Diagnostics")),
      },
      { path: "/about", component: lazy(() => import("@/routes/About")) },

      // legacy compatibility routes
      { path: "/hello", component: () => <Navigate href="/home" /> },
      { path: "/main", component: () => <Navigate href="/search/new" /> },
      { path: "/result", component: () => <Navigate href="/results/review" /> },

      { path: "*", component: lazy(() => import("@/routes/NotFound")) },
    ]
  }
];
