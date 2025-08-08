import { lazy } from "solid-js";
import Layout from "@/layout/Layout";

export const routes = [
  {
    path: "/",
    component: (props: any) => <Layout>{props.children}</Layout>,
    children: [
      { path: "/", component: lazy(() => import("@/routes/Loading")) },
      { path: "/hello", component: lazy(() => import("@/routes/Hello")) },
      { path: "/main", component: lazy(() => import("@/routes/Main")) },
      { path: "/result", component: lazy(() => import("@/routes/Result")) },
      { path: "/settings", component: lazy(() => import("@/routes/Settings")) },
      { path: "/about", component: lazy(() => import("@/routes/About")) },
      { path: "*", component: lazy(() => import("@/routes/NotFound")) },
    ]
  }
];
