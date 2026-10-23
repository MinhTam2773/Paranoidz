"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

// Meta Pixel for paranoidz.vn. Kept in one place; move to
// NEXT_PUBLIC_META_PIXEL_ID if the shop ever runs a second pixel.
export const META_PIXEL_ID = "1535409166877970";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Base code: PageView on every page. Production only, so dev and preview
// traffic never pollutes the pixel's data.
export function MetaPixel() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${META_PIXEL_ID}');fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* Raw img is required here: the standard Meta noscript fallback. */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

// Fires once per placed order, deduped by order number as the event ID.
// Renders nothing; no-ops when the pixel script has not loaded (dev).
export function PurchaseTracker({ orderNumber, value }: { orderNumber: string; value: number }) {
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (fired.current === orderNumber) return;
    fired.current = orderNumber;
    if (typeof window.fbq === "function") {
      window.fbq("track", "Purchase", { value, currency: "VND" }, { eventID: orderNumber });
    }
  }, [orderNumber, value]);
  return null;
}
