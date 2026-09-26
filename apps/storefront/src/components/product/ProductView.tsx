"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { formatVnd } from "@/lib/format";
import { ProductTabs } from "./ProductTabs";
import { PurchaseActions } from "./PurchaseActions";

export type ProductVariant = {
  id: string;
  color: string;
  size: string;
  price: number;
  original_price: number | null;
  stock: number;
};
export type ProductImage = { color: string | null; url: string };

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];
const sizeRank = (size: string) => {
  const i = SIZE_ORDER.indexOf(size);
  return i === -1 ? SIZE_ORDER.length : i;
};
const LOW_STOCK = 3; // same threshold as the admin low-stock list

// Only in-stock single-size colourways (e.g. FREE) are preselected.
function defaultSize(variants: ProductVariant[], color: string) {
  const sizes = variants.filter((v) => v.color === color);
  return sizes.length === 1 && sizes[0].stock > 0 ? sizes[0].size : null;
}

const optionClass = (selected: boolean) =>
  `flex h-11 min-w-12 items-center justify-center rounded-sm border px-4 text-button uppercase transition-colors duration-200 ${
    selected
      ? "border-text-primary bg-text-primary text-text-on-dark"
      : "border-border text-text-primary hover:border-text-primary disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:text-text-muted disabled:line-through disabled:hover:border-border"
  }`;

// Gallery + colour/size selection share one state: the colourway drives both.
// Stock 0 variants are unselectable; all-zero = SOLD OUT, can't be carted (ARCHITECTURE.md §3).
// `details` / `sizeGuide` are server-rendered tab panels; the size-guide link opens its tab.
export function ProductView({
  name,
  variants,
  images,
  details,
  sizeGuide,
}: {
  name: string;
  variants: ProductVariant[];
  images: ProductImage[];
  details: ReactNode;
  sizeGuide: ReactNode;
}) {
  const colors = [...new Set(variants.map((v) => v.color))];
  const soldOut = variants.every((v) => v.stock === 0);

  const [color, setColor] = useState(() => (variants.find((v) => v.stock > 0) ?? variants[0])?.color ?? null);
  const [size, setSize] = useState(() => (color ? defaultSize(variants, color) : null));
  const [activeImage, setActiveImage] = useState(0);
  const tabs = [
    ...(details ? [{ id: "details", label: "Product details", content: details }] : []),
    ...(sizeGuide ? [{ id: "size-guide", label: "Size guide", content: sizeGuide }] : []),
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const tabsRef = useRef<HTMLElement>(null);
  const sizeGroupRef = useRef<HTMLDivElement>(null);

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
          <div className="relative aspect-3/4 overflow-hidden rounded-sm bg-bg-secondary">
            {mainImage && (
              <Image
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
                  aria-label={`Show image ${i + 1} of ${gallery.length}`}
                  aria-current={i === activeImage}
                  className={`relative aspect-3/4 overflow-hidden rounded-sm border bg-bg-secondary transition-colors duration-200 ${
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
              <h1 className="text-h2 uppercase">{name}</h1>
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
                Colour: <span className="text-text-secondary">{color}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={c === color}
                    onClick={() => pickColor(c)}
                    className={optionClass(c === color)}
                  >
                    {c}
                  </button>
                ))}
              </div>
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
                    Size guide
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
                  Only {selected.stock} left
                </p>
              )}
            </div>

            <PurchaseActions
              variant={selected}
              soldOut={soldOut}
              price={shown ? formatVnd(shown.price) : ""}
              onNeedSize={() => {
                sizeGroupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                sizeGroupRef.current?.querySelector<HTMLButtonElement>("button[aria-pressed]:enabled")?.focus({ preventScroll: true });
              }}
            />
          </div>
        </div>
      </div>

      {tabs.length > 0 && <ProductTabs ref={tabsRef} tabs={tabs} active={activeTab} onChange={setActiveTab} />}
    </>
  );
}
