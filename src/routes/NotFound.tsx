import { Navigate } from "@solidjs/router";

export default function AppNotFoundRoute() {
  return <Navigate href="/home" />;
}
