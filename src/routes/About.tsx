export default function AboutRoute() {
  return (
    <section class="page about-page">
      <div class="vintage-paper about-card">
        <h1>About Waldo Finder</h1>
        <p>
          Waldo Finder is a local-first desktop app that detects Waldo and friends in
          crowded scenes using ONNX Runtime in your own machine.
        </p>
        <p>
          This redesign follows a vintage detective notebook aesthetic while keeping
          the full inference pipeline offline and privacy-focused.
        </p>
        <p>
          Version 0.1.0 · Built with Tauri + SolidJS.
        </p>
      </div>
    </section>
  );
}
