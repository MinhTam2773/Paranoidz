"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { WishlistButton } from "@/components/product/WishlistButton";
import { ThumbImage } from "@/components/product/ThumbImage";
import { trackMeta, type MetaContent } from "@/components/tracking/MetaPixel";
import { addToCart } from "@/lib/cart";
import { flyToCart } from "@/lib/fly-to-cart";
import { formatVnd } from "@/lib/format";
import type { RunwayItem, RunwayLook } from "@/lib/runway-lookbook";
import css from "./RunwayLookbook.module.css";

// Runway lookbook (lookbook-handoff/HANDOFF.md §5, ported from demo/index.html). The cut-outs stand
// in a diagonal queue: the front look is sharp, the ones behind shrink and blur; changing look slides
// the queue forward and sends the old front look out to the right. Product rail on the right (below
// the stage on phones) with real catalog data, adding to the real cart.

// Slot per distance behind the front look; the last entry is the look that just left.
// x: % of the stage width, s: scale, b: blur px, o: opacity.
type Slot = { x: number; s: number; b: number; o: number };
const WIDE: Slot[] = [
  { x: 63, s: 1, b: 0, o: 1 }, { x: 40, s: 0.78, b: 1.8, o: 0.9 }, { x: 26, s: 0.63, b: 3.4, o: 0.74 },
  { x: 15, s: 0.52, b: 5, o: 0.55 }, { x: 6, s: 0.43, b: 6.6, o: 0.34 }, { x: 0, s: 0.36, b: 8, o: 0 },
  { x: 98, s: 1.12, b: 3, o: 0 },
];
const NARROW: Slot[] = [
  { x: 58, s: 1, b: 0, o: 1 }, { x: 25, s: 0.74, b: 2.2, o: 0.82 }, { x: 6, s: 0.58, b: 4.4, o: 0.5 },
  { x: -8, s: 0.48, b: 6, o: 0 }, { x: -8, s: 0.48, b: 6, o: 0 }, { x: -8, s: 0.48, b: 6, o: 0 },
  { x: 112, s: 1.1, b: 3, o: 0 },
];
const AUTOPLAY_MS = 5000;
const HOLD_MS = 12000; // autoplay pause after any interaction
const WHEEL_LOCK_MS = 850;

const pad = (i: number) => String(i + 1).padStart(2, "0");

type Pick = { color?: string; size?: string };

export function RunwayLookbook({ looks }: { looks: RunwayLook[] }) {
  const n = looks.length;
  const [cur, setCur] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [ready, setReady] = useState(false);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const stageRef = useRef<HTMLElement>(null);
  const runwayRef = useRef<HTMLDivElement>(null);
  const curRef = useRef(0);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);
  const inView = useRef(false);

  const go = useCallback((i: number) => {
    const next = ((i % n) + n) % n;
    curRef.current = next;
    setCur(next);
    setMissing(new Set());
    setStatus("");
  }, [n]);
  const hold = () => { pausedUntil.current = performance.now() + HOLD_MS; };

  // Narrow slot table below 620px of stage; transitions only after the first frame has landed.
  useEffect(() => {
    const runway = runwayRef.current!;
    const ro = new ResizeObserver(() => setNarrow(runway.clientWidth < 620));
    ro.observe(runway);
    let raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setReady(true)); });
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  // Keys, wheel, swipe, autoplay. The arrow keys only while the section is on screen; the wheel only
  // on wide screens, and it hands the scroll back to the page past the first / last look, so the
  // section can't trap the page.
  useEffect(() => {
    const stage = stageRef.current!;
    const io = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; }, { threshold: 0.5 });
    io.observe(stage);

    const onKey = (e: KeyboardEvent) => {
      if (!inView.current || (e.target as Element | null)?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") { go(curRef.current + 1); hold(); }
      if (e.key === "ArrowLeft") { go(curRef.current - 1); hold(); }
    };
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      const dv = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(dv) < 8 || innerWidth <= 900) return;
      const c = curRef.current;
      if ((dv > 0 && c === n - 1) || (dv < 0 && c === 0)) return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelLock) return;
      wheelLock = now + WHEEL_LOCK_MS;
      go(c + (dv > 0 ? 1 : -1));
      hold();
    };
    let tx: number | null = null;
    let ty = 0;
    const onTouchStart = (e: TouchEvent) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(curRef.current + (dx < 0 ? 1 : -1)); hold(); }
      tx = null;
    };
    const onEnter = () => { hovering.current = true; };
    const onLeave = () => { hovering.current = false; };

    addEventListener("keydown", onKey);
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);
    const timer = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? undefined
      : setInterval(() => {
          if (inView.current && !hovering.current && !document.hidden && performance.now() > pausedUntil.current) go(curRef.current + 1);
        }, AUTOPLAY_MS);
    return () => {
      io.disconnect();
      removeEventListener("keydown", onKey);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
      clearInterval(timer);
    };
  }, [go, n]);

  const look = looks[cur];
  const slots = narrow ? NARROW : WIDE;
  const keyOf = (item: RunwayItem) => `${cur}:${item.slug}`;
  const total = look.items.reduce((sum, item) => sum + item.price, 0);

  // The variant an item would add: its colour (preselected when there is one option) and size
  // (preselected when that colour has one size in stock), or null while the customer still has to pick.
  function resolve(item: RunwayItem) {
    const pick = picks[keyOf(item)] ?? {};
    const option = item.options.length === 1 ? item.options[0] : item.options.find((o) => o.color === pick.color);
    if (!option) return null;
    return option.variants.length === 1 ? option.variants[0] : option.variants.find((v) => v.size === pick.size) ?? null;
  }
  function setPick(item: RunwayItem, pick: Pick) {
    setPicks((p) => ({ ...p, [keyOf(item)]: { ...p[keyOf(item)], ...pick } }));
    setMissing((m) => { const next = new Set(m); next.delete(keyOf(item)); return next; });
    hold();
  }

  function add(e: MouseEvent<HTMLButtonElement>, list: RunwayItem[]) {
    hold();
    const resolved = list.map((item) => ({ item, variant: resolve(item) }));
    const unresolved = resolved.filter((r) => !r.variant);
    if (unresolved.length) {
      setMissing(new Set(unresolved.map((r) => keyOf(r.item))));
      setStatus(list.length === 1 ? "Chọn màu và size trước khi thêm vào giỏ" : "Chọn màu và size cho các món được đánh dấu");
      return;
    }
    const contents: MetaContent[] = [];
    const added = flyToCart(e.currentTarget, list[0].imageUrl ?? undefined, () =>
      resolved.reduce((sum, { variant }) => {
        const got = addToCart(variant!.id, 1, variant!.stock);
        if (got > 0) contents.push({ id: variant!.id, quantity: got, item_price: variant!.price });
        return sum + got;
      }, 0),
    );
    if (contents.length) trackMeta("AddToCart", contents);
    setStatus(
      added === list.length
        ? list.length === 1 ? `Đã thêm vào giỏ: ${list[0].name}` : `Đã thêm cả bộ look ${pad(cur)} (${added} món) vào giỏ`
        : added > 0
          ? `Đã thêm ${added}/${list.length} món, số còn lại đã hết hàng hoặc đã có đủ trong giỏ`
          : "Các món này đã có đủ số lượng còn lại trong giỏ của bạn",
    );
  }

  return (
    <section className={css.show} aria-label="Lookbook BST 2026">
      <section ref={stageRef} className={css.stage} aria-roledescription="carousel" aria-label="Lookbook">
        <div className={css.copy}>
          <div className={css.eyebrow}>Lookbook · BST 2026</div>
          <h2 className={css.title}>Phối cùng PDZ</h2>
          <p className={css.lede}>{n} mẫu áo PDZ, mỗi mẫu một bộ phối cùng balo và túi đang bán. Bấm vào người phía sau để xem bộ tiếp theo.</p>
        </div>

        <div ref={runwayRef} className={`${css.runway} ${ready ? css.ready : ""}`}>
          {looks.map((l, i) => {
            const d = (i - cur + n) % n;
            const slot = d === n - 1 ? slots[6] : slots[Math.min(d, 5)];
            const front = d === 0;
            const style = {
              "--x": slot.x, "--s": slot.s, "--b": slot.b, "--o": slot.o, "--k": l.k ?? 1, "--lift": l.full ? 4 : 0,
              zIndex: d === n - 1 ? 11 : 10 - d,
            } as CSSProperties;
            return (
              <button
                key={l.image}
                type="button"
                className={`${css.fig} ${front ? css.front : ""} ${l.full ? css.full : ""}`}
                style={style}
                tabIndex={front || slot.o === 0 ? -1 : 0}
                aria-hidden={slot.o === 0}
                aria-label={`Xem look ${pad(i)}: ${l.title}`}
                onClick={() => { if (!front) { go(i); hold(); } }}
              >
                <Image
                  src={l.image}
                  alt=""
                  width={l.width}
                  height={l.height}
                  sizes="(max-width: 900px) 70vw, 40vw"
                  priority={i === 0}
                  loading={i === 0 ? undefined : "lazy"}
                  draggable={false}
                />
              </button>
            );
          })}
        </div>

        <div className={css.caption}>
          <div className={css.lookLabel} aria-live="polite">
            <span className={css.lookWord}>LOOK</span>
            <span key={cur} className={`${css.lookNum} ${css.swap}`}>{pad(cur)}</span>
            <span className={css.lookOf}>/ {pad(n - 1)}</span>
          </div>
          <div className={css.lookTitle}>{look.title}</div>
          <div className={css.ctaRow}>
            {look.items.length > 0 && (
              <button type="button" className={css.buy} onClick={(e) => add(e, look.items)}>
                Thêm cả bộ <b>{formatVnd(total)}</b>
              </button>
            )}
            <div className={css.arrows}>
              <button type="button" className={css.arrow} aria-label="Look trước" onClick={() => { go(cur - 1); hold(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <button type="button" className={css.arrow} aria-label="Look tiếp theo" onClick={() => { go(cur + 1); hold(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <p className={css.status} role="status">{status}</p>
        </div>

        <div className={css.dots} role="tablist" aria-label="Chọn look">
          {looks.map((l, i) => (
            <button
              key={l.image}
              type="button"
              role="tab"
              className={css.dot}
              aria-label={`Look ${pad(i)}`}
              aria-selected={i === cur}
              onClick={() => { go(i); hold(); }}
            />
          ))}
        </div>
        <div className={css.hint}>Lăn chuột, vuốt hoặc bấm ← → để đổi look</div>
      </section>

      <aside className={css.rail} aria-label="Sản phẩm trong look">
        <div className={css.railHead}>
          <span>Trong <strong>look {pad(cur)}</strong></span>
          <span>{look.items.length} món</span>
        </div>
        <div className={css.items}>
          {look.items.map((item) => {
            const pick = picks[keyOf(item)] ?? {};
            const option = item.options.length === 1 ? item.options[0] : item.options.find((o) => o.color === pick.color);
            const imageUrl = option?.imageUrl ?? item.imageUrl;
            const off = item.originalPrice && item.originalPrice > item.price ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
            const href = `/products/${item.slug}`;
            return (
              <article key={keyOf(item)} className={`${css.item} ${missing.has(keyOf(item)) ? css.missing : ""}`}>
                <Link className={css.itemImg} href={href} tabIndex={-1} aria-hidden>
                  {imageUrl && <ThumbImage src={imageUrl} thumb={600} alt="" width={600} height={600} sizes="(max-width: 900px) 64vw, 312px" />}
                </Link>
                {off > 0 && <span className={css.off}>-{off}%</span>}
                <WishlistButton productId={item.productId} className={css.heart} />
                <div className={css.itemInfo}>
                  <Link className={css.itemName} href={href}>{item.name}</Link>
                  <button type="button" className={css.add} aria-label={`Thêm ${item.name} vào giỏ`} onClick={(e) => add(e, [item])}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                  {item.options.length > 1 && (
                    <div className={css.chips} role="group" aria-label="Màu">
                      {item.options.map((o) => (
                        <button key={o.color} type="button" aria-pressed={o.color === pick.color} onClick={() => setPick(item, { color: o.color, size: undefined })}>
                          {o.color}
                        </button>
                      ))}
                    </div>
                  )}
                  {option && option.variants.length > 1 && (
                    <div className={css.chips} role="group" aria-label="Size">
                      {option.variants.map((v) => (
                        <button key={v.id} type="button" aria-pressed={v.size === pick.size} onClick={() => setPick(item, { size: v.size })}>
                          {v.size}
                        </button>
                      ))}
                    </div>
                  )}
                  {item.options.length === 1 && <span className={css.meta}>Màu: {item.options[0].color}</span>}
                  <span className={css.price}>
                    <b>{formatVnd(item.price)}</b>
                    {off > 0 && <s>{formatVnd(item.originalPrice!)}</s>}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </aside>
    </section>
  );
}
