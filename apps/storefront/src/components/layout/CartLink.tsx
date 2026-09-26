"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cartItemCount, useCart } from "@/lib/cart";
import { CART_FLY_END, CART_FLY_START } from "@/lib/fly-to-cart";
import { BagIcon } from "./icons";

// Header cart icon + red count badge (DESIGN.md §4). Client-side: the cart lives in localStorage.
// While a fly-to-cart thumbnail is in the air the old count stays up; on landing it updates and pops.
export function CartLink() {
  const count = useCart().reduce((sum, l) => sum + l.qty, 0);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [bump, setBump] = useState(0);
  const badgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onStart = () => {
      const before = cartItemCount(); // read now: the cart write happens right after this event
      setFrozen((f) => f ?? before);
    };
    const onEnd = (e: Event) => {
      setFrozen(null);
      if ((e as CustomEvent<{ added: number }>).detail.added > 0) setBump((b) => b + 1);
    };
    window.addEventListener(CART_FLY_START, onStart);
    window.addEventListener(CART_FLY_END, onEnd);
    return () => {
      window.removeEventListener(CART_FLY_START, onStart);
      window.removeEventListener(CART_FLY_END, onEnd);
    };
  }, []);

  useEffect(() => {
    if (!bump || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    badgeRef.current?.animate([{ transform: "scale(1)" }, { transform: "scale(1.5)" }, { transform: "scale(1)" }], {
      duration: 400,
      easing: "ease-out",
    });
  }, [bump]);

  const shown = frozen ?? count;

  return (
    <Link
      href="/cart"
      data-cart-icon
      aria-label={`Cart, ${count} items`}
      className="relative flex size-11 items-center justify-center"
    >
      <BagIcon />
      {shown > 0 && (
        <span
          ref={badgeRef}
          className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-caption text-text-on-dark"
        >
          {shown}
        </span>
      )}
    </Link>
  );
}
