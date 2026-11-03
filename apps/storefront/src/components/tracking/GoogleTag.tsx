"use client";

import Script from "next/script";

// Google Ads tag + order conversion. Both values come from Google Ads → Goals → Conversions; either
// unset = nothing loads. Vercel Production only, like the Meta pixel: previews and e2e never count.
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
const ENABLED = process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && !!GOOGLE_ADS_ID && !!PURCHASE_LABEL;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleTag() {
  if (!ENABLED) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`} strategy="afterInteractive" />
      <Script id="google-tag" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${GOOGLE_ADS_ID}');`}
      </Script>
    </>
  );
}

// transaction_id = order number, so Google counts one conversion per order.
export function trackGooglePurchase(orderNumber: string, value: number) {
  if (!ENABLED) return;
  window.gtag?.("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${PURCHASE_LABEL}`,
    value,
    currency: "VND",
    transaction_id: orderNumber,
  });
}
