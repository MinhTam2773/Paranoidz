-- Colour swatches on the storefront product card (client reference, 2026-10-12).
-- The admin picks one hex per colour; it is written to every size of that colour,
-- so rename_product_color() carries it along unchanged. Readers take the first
-- non-null hex per colour (a size added later starts without one). NULL = no
-- swatch, the card shows the colour name instead.
alter table public.product_variants
  add column color_hex text check (color_hex ~ '^#[0-9a-f]{6}$');
