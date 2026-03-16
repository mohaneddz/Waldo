import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";

type BBox = [number, number, number, number];

interface Coord {
  class: string;
  confidence: number;
  bbox: BBox;
}

interface Props {
  src: string;
  boxes?: Coord[];
  highlight?: boolean;
  zoom?: number;
  lensSize?: number;
  class?: string;
}

export default function Image(props: Props) {
  let containerRef: HTMLDivElement | undefined;
  let imgRef: HTMLImageElement | undefined;

  const [loaded, setLoaded] = createSignal(false);
  const [dispW, setDispW] = createSignal(0);
  const [dispH, setDispH] = createSignal(0);
  const [natW, setNatW] = createSignal(0);
  const [natH, setNatH] = createSignal(0);
  const [imageLeft, setImageLeft] = createSignal(0);
  const [imageTop, setImageTop] = createSignal(0);

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

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const measureImage = () => {
    if (!containerRef || !imgRef) {
      return;
    }

    const containerRect = containerRef.getBoundingClientRect();
    const naturalWidth = natW();
    const naturalHeight = natH();

    if (naturalWidth > 0 && naturalHeight > 0) {
      // The <img> element is full-size while object-contain fits content inside it.
      // Compute the actual rendered content box to align overlays correctly.
      const scale = Math.min(
        containerRect.width / naturalWidth,
        containerRect.height / naturalHeight,
      );
      const renderedWidth = naturalWidth * scale;
      const renderedHeight = naturalHeight * scale;

      setDispW(renderedWidth);
      setDispH(renderedHeight);
      setImageLeft(Math.max(0, (containerRect.width - renderedWidth) / 2));
      setImageTop(Math.max(0, (containerRect.height - renderedHeight) / 2));
      return;
    }

    const imgRect = imgRef.getBoundingClientRect();
    setDispW(imgRect.width);
    setDispH(imgRect.height);
    setImageLeft(Math.max(0, imgRect.left - containerRect.left));
    setImageTop(Math.max(0, imgRect.top - containerRect.top));
  };

  const onImgLoad = (event: Event) => {
    const img = event.currentTarget as HTMLImageElement;
    setLoaded(true);
    setNatW(img.naturalWidth);
    setNatH(img.naturalHeight);
    requestAnimationFrame(measureImage);
  };

  const updateMouse = (event: MouseEvent) => {
    if (!containerRef || !loaded() || dispW() <= 0 || dispH() <= 0) {
      setHovering(false);
      return;
    }

    const rect = containerRef.getBoundingClientRect();
    const x = event.clientX - rect.left - imageLeft();
    const y = event.clientY - rect.top - imageTop();
    const insideImage =
      x >= 0 &&
      y >= 0 &&
      x <= dispW() &&
      y <= dispH();

    if (!insideImage) {
      setHovering(false);
      return;
    }

    setHovering(true);
    setMouseX(clamp(x, 0, dispW()));
    setMouseY(clamp(y, 0, dispH()));
  };

  const lensStyle = () => {
    const width = lensSize();
    const height = lensSize();
    const left = imageLeft() + clamp(mouseX() - width / 2, 0, Math.max(0, dispW() - width));
    const top = imageTop() + clamp(mouseY() - height / 2, 0, Math.max(0, dispH() - height));
    const bgWidth = dispW() * zoom();
    const bgHeight = dispH() * zoom();
    const bgX = -(mouseX() * zoom() - width / 2);
    const bgY = -(mouseY() * zoom() - height / 2);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      "background-image": `url(${props.src})`,
      "background-size": `${bgWidth}px ${bgHeight}px`,
      "background-position": `${bgX}px ${bgY}px`,
    } as const;
  };

  const boxStyle = (bbox: BBox) => {
    const x1 = bbox[0] * scaleX();
    const y1 = bbox[1] * scaleY();
    const x2 = bbox[2] * scaleX();
    const y2 = bbox[3] * scaleY();
    const width = Math.max(0, x2 - x1);
    const height = Math.max(0, y2 - y1);

    return {
      left: `${imageLeft() + x1}px`,
      top: `${imageTop() + y1}px`,
      width: `${width}px`,
      height: `${height}px`,
      "background-image": `url(${props.src})`,
      "background-size": `${dispW()}px ${dispH()}px`,
      "background-position": `${-x1}px ${-y1}px`,
    } as const;
  };

  createEffect(() => {
    props.src;
    setLoaded(false);
    setHovering(false);
    setDispW(0);
    setDispH(0);
    setNatW(0);
    setNatH(0);
    setImageLeft(0);
    setImageTop(0);
  });

  onMount(() => {
    const observer = new ResizeObserver(() => {
      measureImage();
    });

    if (containerRef) {
      observer.observe(containerRef);
    }

    if (imgRef) {
      observer.observe(imgRef);
    }

    window.addEventListener("resize", measureImage);

    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", measureImage);
    });
  });

  return (
    <div
      ref={containerRef}
      class={`relative ${props.class ?? ""}`}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={updateMouse}
    >
      <img
        ref={imgRef}
        src={props.src}
        onLoad={onImgLoad}
        class="block h-full w-full rounded object-contain select-none"
        style={props.highlight ? { filter: "blur(3px) brightness(0.6)" } : {}}
        alt=""
        draggable={false}
      />

      <div class="pointer-events-none absolute inset-0">
        <Show
          when={
            loaded() &&
            props.highlight &&
            props.boxes &&
            props.boxes.length > 0
          }
        >
          <For each={props.boxes!}>
            {(box, index) => (
              <div class="absolute overflow-hidden rounded" style={boxStyle(box.bbox)}>
                <div
                  class="absolute inset-0 rounded"
                  style={{
                    border: `2px solid ${palette[index() % palette.length]}`,
                  }}
                />
              </div>
            )}
          </For>
        </Show>

        <Show when={loaded() && hovering()}>
          <div
            class="absolute rounded-md border border-white/70 shadow-lg"
            style={lensStyle()}
          />
        </Show>
      </div>
    </div>
  );
}
