import { MinusIcon, PlusIcon } from "@/components/layout/icons";

// − qty + with 44px touch targets (DESIGN.md §8). Used on the product page and in the cart.
export function QuantityStepper({
  value,
  max,
  onChange,
  label = "Quantity",
}: {
  value: number;
  max: number;
  onChange: (qty: number) => void;
  label?: string;
}) {
  const buttonClass =
    "flex size-11 items-center justify-center text-text-secondary transition-colors duration-200 hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:text-text-muted";

  return (
    <div role="group" aria-label={label} className="flex h-11 w-fit items-center rounded-sm border border-border">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={buttonClass}
      >
        <MinusIcon width={16} height={16} />
      </button>
      <span aria-live="polite" className="w-8 text-center text-button">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={buttonClass}
      >
        <PlusIcon width={16} height={16} />
      </button>
    </div>
  );
}
