-- ============================================================
-- DEV SEED — size guides for the mock catalog. Remove before launch.
-- Separate file: `db push --include-seed` never re-runs dev.sql.
-- Shape: { "sizes": [...], "rows": [{ "label": ..., "values": [...] }] }
-- (ARCHITECTURE.md §7). Values are strings, one per size, units in the label.
-- ============================================================

update public.products set size_guide = '{
  "sizes": ["S", "M", "L", "XL"],
  "rows": [
    { "label": "Chest (cm)",  "values": ["52", "55", "58", "61"] },
    { "label": "Length (cm)", "values": ["70", "72", "74", "76"] },
    { "label": "Height",      "values": ["1m60–1m68", "1m68–1m74", "1m74–1m80", "1m80+"] }
  ]
}'
where slug in ('paranoid-logo-tee', 'static-noise-tee', 'night-shift-boxy-tee') and size_guide is null;

update public.products set size_guide = '{
  "sizes": ["M", "L", "XL"],
  "rows": [
    { "label": "Chest (cm)",  "values": ["62", "65", "68"] },
    { "label": "Length (cm)", "values": ["70", "72", "74"] },
    { "label": "Sleeve (cm)", "values": ["60", "62", "64"] }
  ]
}'
where slug in ('overthink-hoodie', 'signal-zip-hoodie') and size_guide is null;

update public.products set size_guide = '{
  "sizes": ["S", "M", "L", "XL"],
  "rows": [
    { "label": "Waist (cm)",  "values": ["72", "76", "80", "84"] },
    { "label": "Length (cm)", "values": ["98", "100", "102", "104"] }
  ]
}'
where slug in ('paranoid-cargo-pants', 'wide-leg-denim') and size_guide is null;

update public.products set size_guide = '{
  "sizes": ["S", "M", "L"],
  "rows": [
    { "label": "Waist (cm)",  "values": ["70", "74", "78"] },
    { "label": "Length (cm)", "values": ["44", "46", "48"] }
  ]
}'
where slug = 'void-track-shorts' and size_guide is null;
