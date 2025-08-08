import { onCleanup, onMount, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

export default function Loading() {
  const [dots, setDots] = createSignal(".");

  onMount(() => {
    const navigate = useNavigate();
    let count = 0;
    const interval = setInterval(() => {
      count = (count % 3) + 1;
      setDots(".".repeat(count));
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      navigate("/hello");
    }, 3000);

    onCleanup(() => clearInterval(interval));
  });


  return (
    <section class="h-screen w-screen flex items-center justify-center text-center">
      <h1 class="text-7xl font-bold">
        Loading
        <br />
        {dots()}
      </h1>
    </section>
  );
}
