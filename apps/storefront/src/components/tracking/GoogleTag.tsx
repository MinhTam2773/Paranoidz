"use client";

import Script from "next/script";

// Google Ads tag + order conversion "Đơn hàng web" (account 205-602-2319). Public values, kept in one
// place like META_PIXEL_ID. Vercel Production only, like the Meta pixel: previews and e2e never count.
const GOOGLE_ADS_ID = "AW-18554163640";
const PURCHASE_LABEL = "05e-COOUtbEdELijqI9F";
const ENABLED = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
const PURCHASE_RETRY_DELAY_MS = 300;
const PURCHASE_RETRY_LIMIT = 10;
const sentTransactions = new Set<string>();

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
export function trackGooglePurchase(orderNumber: string, value: number, attempt = 0) {
  if (!ENABLED || typeof window === "undefined" || sentTransactions.has(orderNumber)) return;
  if (typeof window.gtag !== "function") {
    if (attempt < PURCHASE_RETRY_LIMIT) {
      window.setTimeout(() => trackGooglePurchase(orderNumber, value, attempt + 1), PURCHASE_RETRY_DELAY_MS);
    }
    return;
  }
  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${PURCHASE_LABEL}`,
    value,
    currency: "VND",
    transaction_id: orderNumber,
  });
  sentTransactions.add(orderNumber);
}
