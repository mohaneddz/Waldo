import Button from "@/components/Buttton";
import { createSignal } from "solid-js";

export default function Settings() {
  const [goingBack, setGoingBack] = createSignal(false);

  const handleGoBack = () => {
    setGoingBack(true);
    setTimeout(() => {
      window.history.back();
    }, 300); // matches exit animation duration
  };

  return (
    <section
      class={`center min-h-screen ${
        goingBack() ? "animate-fadeOutScale" : "animate-fadeInScale"
      }`}
    >
      <div class="bg-primary-dark min-w-[40vw] min-h-[40vw] h-max w-max border rounded-lg center flex-col p-8">
        <h1 class="text-7xl font-bold text-center my-12">About</h1>

        <div class="flex flex-col gap-8 text-lg text-center max-w-[70vw]">
          <p>
            <span class="text-primary-light text-3xl">W</span>aldo&nbsp;&nbsp;
            <span class="text-primary-light text-3xl">A</span>lways&nbsp;&nbsp;
            <span class="text-primary-light text-3xl">L</span>ocates&nbsp;&nbsp;
            <span class="text-primary-light text-3xl">D</span>ifficult&nbsp;&nbsp;
            <span class="text-primary-light text-3xl">O</span>bjects
          </p>
          <div>
            Where's Waldo is a nostalgic game, creating this app was an excuse for me to revisit it :) <br />
            The dataset was handmade by <u>me</u>, solving the entire series of books to find Waldo & his friends.
          </div>
          <p>Walker Books please don't sue me</p>
          <div class="text-sm text-gray-300">
            Version: 1.0.0 <br />
            <a href="https://github.com/mohaneddz/WALDO" class="text-primary-light hover:underline">
              © 2025 MANAA Mohaned
            </a>
          </div>
        </div>

        <div class="w-full mt-12 center">
          <Button
            class="w-full max-w-[40vw] "
            variant="ghost"
            onClick={handleGoBack}
            disabled={goingBack()}
          >
            {goingBack() ? (
              <span class="flex items-center justify-center gap-2">
                <span
                  class="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                Going back...
              </span>
            ) : (
              "Go back"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
