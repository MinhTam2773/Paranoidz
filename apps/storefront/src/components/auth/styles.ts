// Shared by the auth forms. DESIGN.md inputs/buttons; 16px inputs below lg so iOS Safari
// doesn't zoom on focus (same exception as checkout).
export const inputClass =
  "h-11 w-full rounded-sm border bg-bg-primary px-3 text-base text-text-primary lg:text-product-name placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";
export const labelClass = "text-nav uppercase text-text-secondary";
export const errorClass = "text-caption text-accent";
export const primaryClass =
  "h-12 w-full rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:hover:shadow-accent disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted";
export const secondaryClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark disabled:cursor-not-allowed disabled:opacity-50";
export const linkClass = "text-text-primary underline underline-offset-4 hover:text-accent";
