// "Fly to cart": a thumbnail leaves the Add to cart button, rises almost vertically, then bends
// diagonally into the header cart icon ([data-cart-icon]). Quadratic Bézier with its control
// point straight above the start. CartLink holds the old count until CART_FLY_END, then pops.
export const CART_FLY_START = "pz:cart-fly-start";
export const CART_FLY_END = "pz:cart-fly-end"; // detail: { added: number }

const SIZE = 56;
const STEPS = 24;

/** Runs `add` (the real cart write) between the two events and animates if anything was added. */
export function flyToCart(from: Element, imageSrc: string | undefined, add: () => number) {
  window.dispatchEvent(new Event(CART_FLY_START)); // before the write, so CartLink can freeze the old count
  const added = add();
  const end = () => window.dispatchEvent(new CustomEvent(CART_FLY_END, { detail: { added } }));

  const target = document.querySelector("[data-cart-icon]");
  if (!added || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    end();
    return added;
  }

  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const p0 = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const p1 = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  const c = { x: p0.x, y: (p0.y + p1.y) / 2 };

  const flyer = document.createElement("div");
  flyer.setAttribute("aria-hidden", "true");
  flyer.className = `pointer-events-none fixed left-0 top-0 z-50 overflow-hidden rounded-full border-2 border-bg-primary shadow-2 ${
    imageSrc ? "bg-bg-secondary" : "bg-accent"
  }`;
  flyer.style.width = flyer.style.height = `${SIZE}px`;
  if (imageSrc) {
    const img = document.createElement("img");
    img.src = imageSrc; // the already-loaded main image (currentSrc), so no new download
    img.alt = "";
    img.className = "size-full object-cover";
    flyer.append(img);
  }
  document.body.append(flyer);

  const frames = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    const u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x;
    const y = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y;
    return { transform: `translate(${x - SIZE / 2}px, ${y - SIZE / 2}px) scale(${1 - 0.7 * t})` };
  });
  const done = () => {
    flyer.remove();
    end();
  };
  flyer.animate(frames, { duration: 700, easing: "ease-in" }).finished.then(done, done);
  return added;
}
