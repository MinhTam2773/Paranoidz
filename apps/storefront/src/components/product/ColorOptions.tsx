import { optionClass } from "./ProductView";

// Colour choice on the product page and the quick-add sheet: a dot when the admin picked a hex,
// otherwise the text button. The "Màu: …" label above names the selected colour.
export function ColorOptions({
  colors,
  selected,
  onPick,
}: {
  colors: { name: string; hex: string | null }[];
  selected: string | null;
  onPick: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(({ name, hex }) =>
        hex ? (
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
