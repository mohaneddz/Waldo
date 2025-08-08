import { onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";

export default function NotFound() {
  const navigate = useNavigate();

  onMount(() => {
    const timer = setTimeout(() => {
      navigate("/");
    }, 3000);

    return () => clearTimeout(timer);
  });

  return (
    <section>
      NotFound Component
    </section>
  );
};
