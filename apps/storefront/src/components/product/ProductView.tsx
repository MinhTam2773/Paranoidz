"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatVnd } from "@/lib/format";
import { CashIcon, PhoneIcon, ReturnIcon, TruckIcon } from "@/components/layout/icons";
import { ColorOptions } from "./ColorOptions";
import { ProductTabs } from "./ProductTabs";
import { PurchaseActions } from "./PurchaseActions";
import { WishlistButton } from "./WishlistButton";
import {
  DELIVERY_METHODS,
  getDeliveryMethod,
  setDeliveryMethod,
  type DeliveryMethod,
} from "@/lib/delivery-method";
import { recordView } from "@/lib/recently-viewed";

export type ProductVariant = {
  id: string;
  color: string;
  color_hex: string | null;
  size: string;
  price: number;
  original_price: number | null;
  stock: number;
};
export type ProductImage = { color: string | null; url: string };

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];
export const sizeRank = (size: string) => {
  const i = SIZE_ORDER.indexOf(size);
  return i === -1 ? SIZE_ORDER.length : i;
};
const LOW_STOCK = 3; // same threshold as the admin low-stock list

// Only in-stock single-size colourways (e.g. FREE) are preselected.
export function defaultSize(variants: Pick<ProductVariant, "color" | "size" | "stock">[], color: string) {
  const sizes = variants.filter((v) => v.color === color);
  return sizes.length === 1 && sizes[0].stock > 0 ? sizes[0].size : null;
}

export const optionClass = (selected: boolean) =>
  `flex h-11 min-w-12 items-center justify-center rounded-sm border px-4 text-button uppercase transition-colors duration-200 ${
    selected
      ? "border-text-primary bg-text-primary text-text-on-dark"
      : "border-border text-text-primary hover:border-text-primary disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-text-muted disabled:line-through disabled:hover:border-border"
  }`;

// Gallery + colour/size selection share one state: the colourway drives both.
// Stock 0 variants are unselectable; all-zero = SOLD OUT, can't be carted (ARCHITECTURE.md §3).
// `details` / `sizeGuide` are server-rendered tab panels; the size-guide link opens its tab.
// `bundles` (server-rendered) sits between the purchase grid and the tabs. `reviews` is always a tab.
export function ProductView({
  productId,
  name,
  variants,
  images,
  details,
  sizeGuide,
  bundles,
  reviews,
  reviewCount,
}: {
  productId: string;
  name: string;
  variants: ProductVariant[];
  images: ProductImage[];
  details: ReactNode;
  sizeGuide: ReactNode;
  bundles: ReactNode;
  reviews: ReactNode;
  reviewCount: number;
}) {
  // First non-null hex per colour (a size added later has none yet).
  const colors = [...new Set(variants.map((v) => v.color))].map((name) => ({
    name,
    hex: variants.find((v) => v.color === name && v.color_hex)?.color_hex ?? null,
  }));
  const soldOut = variants.every((v) => v.stock === 0);

  // Record this view for the "recently viewed" rail (localStorage, no account needed).
  useEffect(() => {
    recordView(productId);
  }, [productId]);

  const [color, setColor] = useState(() => (variants.find((v) => v.stock > 0) ?? variants[0])?.color ?? null);
  const [size, setSize] = useState(() => (color ? defaultSize(variants, color) : null));
  const [activeImage, setActiveImage] = useState(0);
  // Delivery method picked here carries into checkout (localStorage).
  const [deliveryMethod, setDeliveryMethodState] = useState<DeliveryMethod>(() => getDeliveryMethod());
  const pickDelivery = (m: DeliveryMethod) => {
    setDeliveryMethodState(m);
    setDeliveryMethod(m);
  };
  const tabs = [
    ...(details ? [{ id: "details", label: "Chi tiết sản phẩm", content: details }] : []),
    ...(sizeGuide ? [{ id: "size-guide", label: "Bảng size", content: sizeGuide }] : []),
    { id: "reviews", label: `Đánh giá (${reviewCount})`, content: reviews },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const tabsRef = useRef<HTMLElement>(null);
  const sizeGroupRef = useRef<HTMLDivElement>(null);
  const mainImageRef = useRef<HTMLImageElement>(null);

  const sizes = variants.filter((v) => v.color === color).toSorted((a, b) => sizeRank(a.size) - sizeRank(b.size));
  const selected = sizes.find((v) => v.size === size) ?? null;
  // Before a size is picked, show the cheapest variant the customer can buy.
  const inStock = variants.filter((v) => v.stock > 0);
  const [cheapest] = (inStock.length ? inStock : variants).toSorted((a, b) => a.price - b.price);
  const shown = selected ?? cheapest;
  const onSale = shown?.original_price != null && shown.original_price > shown.price;

  // Colourway images first (primary leads), then general ones.
  const gallery = [...images.filter((i) => i.color === color), ...images.filter((i) => i.color === null)];
  const mainImage = gallery[activeImage] ?? gallery[0];

  function pickColor(next: string) {
    setColor(next);
    setActiveImage(0);
    const keep = variants.some((v) => v.color === next && v.size === size && v.stock > 0);
    setSize(keep ? size : defaultSize(variants, next));
  }

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col gap-2 lg:col-span-7">
          <div className="relative aspect-square overflow-hidden rounded-sm bg-bg-secondary">
            {mainImage && (
              <Image
                ref={mainImageRef}
                src={mainImage.url}
                alt={name}
                fill
                preload
                sizes="(min-width: 1280px) 700px, (min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {gallery.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Xem ảnh ${i + 1} / ${gallery.length}`}
                  aria-current={i === activeImage}
                  className={`relative aspect-square overflow-hidden rounded-sm border bg-bg-secondary transition-colors duration-200 ${
                    i === activeImage ? "border-text-primary" : "border-transparent hover:border-border-hover"
                  }`}
                >
                  <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="flex flex-col gap-6 lg:sticky lg:top-36">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-h2 uppercase">{name}</h1>
                <WishlistButton productId={productId} className="-mr-2 shrink-0 rounded-sm" />
              </div>
              {shown && (
                <p className="flex items-baseline gap-3">
                  <span className={`text-h3 font-bold ${onSale ? "text-accent" : "text-text-primary"}`}>
                    {formatVnd(shown.price)}
                  </span>
                  {onSale && <s className="text-price-old text-text-muted">{formatVnd(shown.original_price!)}</s>}
                </p>
              )}
            </div>

            <div role="group" aria-labelledby="colour-label" className="flex flex-col gap-3">
              <p id="colour-label" className="text-nav uppercase">
                Màu: <span className="text-text-secondary">{color}</span>
              </p>
              <ColorOptions colors={colors} selected={color} onPick={pickColor} />
            </div>

            <div ref={sizeGroupRef} role="group" aria-labelledby="size-label" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p id="size-label" className="text-nav uppercase">Size</p>
                {sizeGuide && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("size-guide");
                      tabsRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-caption text-text-secondary underline hover:text-text-primary"
                  >
                    Bảng size
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={v.size === size}
                    disabled={v.stock === 0}
                    onClick={() => setSize(v.size)}
                    className={optionClass(v.size === size)}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
              {selected && selected.stock <= LOW_STOCK && (
                <p className="flex items-center gap-2 text-caption text-text-secondary">
                  <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
                  Chỉ còn {selected.stock} sản phẩm
                </p>
              )}
            </div>

            {/* Delivery method: customer picks standard or HCMC express here; the choice
                carries into checkout via localStorage. */}
            <div role="radiogroup" aria-labelledby="delivery-label" className="flex flex-col gap-3">
              <p id="delivery-label" className="text-nav uppercase">Phương thức giao hàng</p>
              <div className="flex flex-col gap-2">
                {DELIVERY_METHODS.map((m) => {
                  const active = deliveryMethod === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickDelivery(m.value)}
                      className={`flex items-center gap-3 rounded-sm border p-3 text-left transition-colors duration-200 ${
                        active ? "border-text-primary bg-bg-secondary" : "border-border hover:border-border-hover"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                          active ? "border-accent" : "border-border"
                        }`}
                      >
                        {active && <span className="size-2.5 rounded-full bg-accent" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-caption font-semibold uppercase tracking-[0.04em] text-text-primary">{m.label}</span>
                        <span className="block text-caption text-text-secondary">{m.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <PurchaseActions
              variant={selected}
              soldOut={soldOut}
              price={shown ? formatVnd(shown.price) : ""}
              name={name}
              thumbnailUrl={mainImage?.url ?? null}
              imageRef={mainImageRef}
              onNeedSize={() => {
                sizeGroupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                sizeGroupRef.current?.querySelector<HTMLButtonElement>("button[aria-pressed]:enabled")?.focus({ preventScroll: true });
              }}
            />

            {/* Trust row (Hydra-style): the four reassurances, right where the buy decision happens. */}
            <div className="grid grid-cols-2 gap-px border border-border bg-border">
              {[
                [TruckIcon, "SPX Express", "Giao nhanh toàn quốc"],
                [CashIcon, "Thanh toán COD", "Nhận hàng rồi trả tiền"],
                [ReturnIcon, "Đổi trả 7 ngày", "Nếu sản phẩm lỗi do shop"],
                [PhoneIcon, "Hotline", "0345 267 709"],
              ].map(([Icon, title, sub]) => {
                const I = Icon as (p: { width?: number; height?: number }) => ReactNode;
                return (
                  <div key={title as string} className="flex items-center gap-3 bg-bg-primary p-3">
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-text-primary">
                      <I width={18} height={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-caption font-semibold uppercase tracking-[0.04em] text-text-primary">{title as string}</span>
                      <span className="block truncate text-caption text-text-secondary">{sub as string}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {bundles}
      {tabs.length > 0 && <ProductTabs ref={tabsRef} tabs={tabs} active={activeTab} onChange={setActiveTab} />}
    </>
  );
}
