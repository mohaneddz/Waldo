import { createSignal, onMount, Show, For } from "solid-js";

type BBox = [number, number, number, number];
interface Coord {
  class: string;
  confidence: number;
  bbox: BBox; // [x1, y1, x2, y2] in original image pixel space
}

interface Props {
  src: string; // image url or data uri
  boxes?: Coord[]; // detected boxes
  highlight?: boolean; // when true, blur+dim everything except boxes
  zoom?: number; // magnifier zoom level
  lensSize?: number; // magnifier lens size in px
  class?: string; // container classes
}

export default function Image(props: Props) {
  let containerRef: HTMLDivElement | undefined;
  let imgRef: HTMLImageElement | undefined;

  const [loaded, setLoaded] = createSignal(false);
  const [dispW, setDispW] = createSignal(0);
  const [dispH, setDispH] = createSignal(0);
  const [natW, setNatW] = createSignal(0);
  const [natH, setNatH] = createSignal(0);

  const [hovering, setHovering] = createSignal(false);
  const [mouseX, setMouseX] = createSignal(0);
  const [mouseY, setMouseY] = createSignal(0);

  const zoom = () => props.zoom ?? 2;
  const lensSize = () => props.lensSize ?? 200;

  const scaleX = () => (natW() ? dispW() / natW() : 1);
  const scaleY = () => (natH() ? dispH() / natH() : 1);

  const palette = [
    "#ff3b30",
    "#34c759",
    "#007aff",
    "#ffcc00",
    "#af52de",
    "#ff9f0a",
    "#64d2ff",
    "#bf5af2",
  ];

  const onImgLoad = (e: Event) => {
    const img = e.currentTarget as HTMLImageElement;
    setLoaded(true);
    setNatW(img.naturalWidth);
    setNatH(img.naturalHeight);
    queueMicrotask(() => {
      if (imgRef) {
        setDispW(imgRef.clientWidth);
        setDispH(imgRef.clientHeight);
      }
    });
  };

  const updateMouse = (ev: MouseEvent) => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(ev.clientY - rect.top, rect.height));
    setMouseX(x);
    setMouseY(y);
  };

  const lensStyle = () => {
    const w = lensSize();
    const h = lensSize();
    const x = Math.max(w / 2, Math.min(mouseX(), dispW() - w / 2));
    const y = Math.max(h / 2, Math.min(mouseY(), dispH() - h / 2));

    const bgW = dispW() * zoom();
    const bgH = dispH() * zoom();
    const bgX = -(mouseX() * zoom() - w / 2);
    const bgY = -(mouseY() * zoom() - h / 2);

    return {
      left: `${x - w / 2}px`,
      top: `${y - h / 2}px`,
      width: `${w}px`,
      height: `${h}px`,
      "background-image": `url(${props.src})`,
      "background-size": `${bgW}px ${bgH}px`,
      "background-position": `${bgX}px ${bgY}px`,
    } as const;
  };

  const boxStyle = (bbox: BBox) => {
    const x1 = bbox[0] * scaleX();
    const y1 = bbox[1] * scaleY();
    const x2 = bbox[2] * scaleX();
    const y2 = bbox[3] * scaleY();
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);

    // background-position is negative offset to align source
    return {
      left: `${x1}px`,
      top: `${y1}px`,
      width: `${w}px`,
      height: `${h}px`,
      "background-image": `url(${props.src})`,
      "background-size": `${dispW()}px ${dispH()}px`,
      "background-position": `${-x1}px ${-y1}px`,
    } as const;
  };

  // Keep displayed size in sync on window resize
  onMount(() => {
    const onResize = () => {
      if (imgRef) {
        setDispW(imgRef.clientWidth);
        setDispH(imgRef.clientHeight);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  return (
    <div
      ref={containerRef}
      class={`relative inline-block ${props.class ?? ""}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={updateMouse}
      style={{
        // Let image define size; container matches img dimensions
        width: dispW() ? `${dispW()}px` : undefined,
        height: dispH() ? `${dispH()}px` : undefined,
      }}
    >
      {/* Base image (optionally blurred/dimmed) */}
      <img
        ref={imgRef}
        src={props.src}
        onLoad={onImgLoad}
        class={`block max-w-full max-h-full rounded ${
          props.highlight ? "" : ""
        }`}
        style={
          props.highlight
            ? { filter: "blur(3px) brightness(0.6)" }
            : {}
        }
        alt=""
      />

      {/* Unblurred focus rectangles when highlight is on */}
      <Show
        when={
          loaded() &&
          props.highlight &&
          props.boxes &&
          props.boxes.length > 0
        }
      >
        <For each={props.boxes!}>
          {(b, i) => (
            <div
              class="absolute overflow-hidden"
              style={boxStyle(b.bbox)}
            >
              {/* Unblurred crop via background image above */}
              <div
                class="absolute inset-0 rounded"
                style={{
                  border: `2px solid ${palette[i() % palette.length]}`,
                }}
              />
            </div>
          )}
        </For>
      </Show>

      {/* Hover magnifier lens */}
      <Show when={loaded() && hovering()}>
        <div
          class="absolute pointer-events-none rounded-md border border-white/70 shadow-lg"
          style={lensStyle()}
        />
      </Show>
    </div>
  );
}
