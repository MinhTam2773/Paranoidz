"use client";

import { PROVINCES, searchKey } from "@paranoidz/db/provinces";
import { SearchSelect } from "./SearchSelect";

const OPTIONS = PROVINCES.map((p) => ({
  value: p.name,
  keys: [p.name, ...(p.formerly ?? []), ...(p.aliases ?? [])].map(searchKey),
  formerly: p.formerly ?? [],
}));

// The 34 provinces; search also matches pre-2025 province names and says so.
export function ProvinceSelect(props: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  return (
    <SearchSelect
      {...props}
      options={OPTIONS}
      label="Tỉnh / thành phố"
      searchPlaceholder="Tìm, ví dụ Hồ Chí Minh"
      noMatch={(query) => `Không có tỉnh / thành phố nào khớp với “${query}”.`}
      // Matched via a merged pre-2025 province: say so (aliases like "Sài Gòn" need no hint).
      hint={(o, q) => {
        const p = OPTIONS.find((x) => x.value === o.value)!;
        if (p.keys[0].includes(q)) return null;
        const via = p.formerly.find((n) => searchKey(n).includes(q));
        return via ? `incl. ${via}` : null;
      }}
    />
  );
}
