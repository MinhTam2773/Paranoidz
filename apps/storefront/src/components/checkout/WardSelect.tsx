"use client";

import { useEffect, useMemo, useState } from "react";
import { listWards } from "@/app/checkout/actions";
import { searchKey } from "@paranoidz/db/provinces";
import { matchWard } from "@paranoidz/db/spx/order-body";
import { SearchSelect } from "./SearchSelect";

// SPX's wards for the chosen province (ARCHITECTURE.md §5 "SPX Open API"); disabled until a
// province is chosen. When the list loads, a value it doesn't hold — a saved address's typed ward
// or the previous province's ward — becomes the matching SPX ward (accents, case and the
// "Phường" / "Xã" prefix ignored) or "", through onResolve: that isn't the customer's edit.
export function WardSelect({
  city,
  value,
  onChange,
  onResolve,
  ...props
}: {
  id: string;
  name: string;
  city: string;
  value: string;
  onChange: (value: string) => void;
  onResolve: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const [loaded, setLoaded] = useState<{ city: string; wards: string[] } | null>(null);
  const wards = city && loaded?.city === city ? loaded.wards : null;
  const options = useMemo(() => (wards ?? []).map((w) => ({ value: w, keys: [searchKey(w)] })), [wards]);

  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    listWards(city).then((list) => {
      if (!cancelled) setLoaded({ city, wards: list });
    });
    return () => {
      cancelled = true;
    };
  }, [city]);

  useEffect(() => {
    if (wards && value && !wards.includes(value)) onResolve(matchWard(value, wards) ?? "");
  }, [wards, value, onResolve]);

  return (
    <SearchSelect
      {...props}
      value={value}
      onChange={onChange}
      options={options}
      disabled={!wards}
      emptyText={!city ? "Chọn tỉnh / thành phố trước" : !wards ? "Đang tải…" : "Chọn…"}
      label="Phường / xã"
      searchPlaceholder="Tìm, ví dụ Bến Thành"
      noMatch={(query) => (query ? `Không có phường / xã nào khớp với “${query}”.` : "Chưa tải được danh sách phường / xã.")}
    />
  );
}
