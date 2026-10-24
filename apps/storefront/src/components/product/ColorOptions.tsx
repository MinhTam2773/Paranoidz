import Image from "next/image";
import { optionClass } from "./ProductView";

// Colour choice on the product page and the quick-add sheet. A colour with its
// own photo gets a Shopee-style button (thumbnail + name, red border and tick
// when selected) — except in the quick-add sheet, which keeps the dots
// (owner 2026-10-24). Otherwise a dot when the admin picked a hex, else the
// text button. The "Màu: …" label above names the selected colour.
export function ColorOptions({
  colors,
  selected,
  onPick,
  thumbnails = true,
}: {
  colors: { name: string; hex: string | null; imageUrl: string | null }[];
  selected: string | null;
  onPick: (color: string) => void;
  thumbnails?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(({ name, hex, imageUrl }) =>
        imageUrl && thumbnails ? (
          <button
            key={name}
            type="button"
            aria-pressed={name === selected}
            aria-label={name}
            title={name}
            onClick={() => onPick(name)}
            className={`relative flex items-center gap-2 rounded-sm border-2 bg-bg-primary py-1 pl-1 pr-3 transition-colors duration-200 ${
              name === selected ? "border-accent" : "border-border hover:border-border-hover"
            }`}
          >
            <Image src={imageUrl} alt="" width={36} height={36} className="rounded-sm object-cover" />
            <span className="text-button">{name}</span>
            {name === selected && (
              <span
                aria-hidden
                className="absolute -bottom-px -right-px rounded-tl-sm bg-accent px-1 py-px text-[11px] font-bold leading-none text-white"
              >
                ✓
              </span>
            )}
          </button>
        ) : hex ? (
          <button
            key={name}
            type="button"
            aria-pressed={name === selected}
            aria-label={name}
            title={name}
            onClick={() => onPick(name)}
            className="flex size-11 items-center justify-center rounded-full"
          >
            <span
              className={`size-8 rounded-full border border-border transition-shadow duration-200 ${name === selected ? "ring-2 ring-text-primary ring-offset-2" : ""}`}
              style={{ backgroundColor: hex }}
            />
          </button>
        ) : (
          <button key={name} type="button" aria-pressed={name === selected} onClick={() => onPick(name)} className={optionClass(name === selected)}>
            {name}
          </button>
        ),
      )}
    </div>
  );
}
