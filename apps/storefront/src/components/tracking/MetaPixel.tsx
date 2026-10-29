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

// One catalog item. ids match /meta-feed.xml: a variant id is an item, a product id its item group
// (content_type "product_group", ViewContent only), so Advantage+ catalog ads can show what was seen.
export type MetaContent = { id: string; quantity: number; item_price: number };

// Standard event with the catalog fields. The base code runs afterInteractive, so an event raised
// before it (first page view) waits up to ~3s; never fires in dev, where the base code is off.
export function trackMeta(
  event: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase",
  contents: MetaContent[],
  options: { contentType?: "product" | "product_group"; value?: number; eventID?: string } = {},
  attempt = 0,
) {
  if (typeof window.fbq !== "function") {
    if (process.env.NODE_ENV === "production" && attempt < 10) setTimeout(() => trackMeta(event, contents, options, attempt + 1), 300);
    return;
  }
  const params = {
    content_type: options.contentType ?? "product",
    content_ids: contents.map((c) => c.id),
    contents,
    num_items: contents.reduce((n, c) => n + c.quantity, 0),
    value: options.value ?? contents.reduce((sum, c) => sum + c.item_price * c.quantity, 0),
    currency: "VND",
  };
  if (options.eventID) window.fbq("track", event, params, { eventID: options.eventID });
  else window.fbq("track", event, params);
}

// Fires once per placed order, deduped by order number as the event ID (the server sends the same
// Purchase through the Conversions API, lib/meta-capi.ts). Renders nothing.
export function PurchaseTracker({ orderNumber, value, contents }: { orderNumber: string; value: number; contents: MetaContent[] }) {
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (fired.current === orderNumber) return;
    fired.current = orderNumber;
    trackMeta("Purchase", contents, { value, eventID: orderNumber });
  }, [orderNumber, value, contents]);
  return null;
}
