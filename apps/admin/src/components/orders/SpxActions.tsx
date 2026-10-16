"use client";

import { useState, useTransition } from "react";
import { createSpxShipment, getSpxLabel } from "@/app/(shell)/orders/[number]/actions";
import { Toast, type ToastMessage } from "../Toast";

const button = "h-10 w-full rounded-sm px-4 text-button uppercase transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";
const select =
  "h-10 w-full rounded-sm border border-border bg-surface px-2 text-base md:text-input focus:border-text-primary focus:outline-none disabled:opacity-50";
const label = "flex flex-col gap-1.5 text-label uppercase text-text-secondary";

// Ward + pickup slot → TẠO ĐƠN SPX. On success the page re-renders with the shipment.
export function SpxCreateForm({ orderId, wards, defaultWard, typedWard, slots }: {
  orderId: string;
  wards: string[];
  defaultWard: string | null;
  typedWard: string | null;
  slots: { value: string; label: string }[];
}) {
  const [ward, setWard] = useState(defaultWard ?? "");
  const [slot, setSlot] = useState(slots[0].value);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const { error } = await createSpxShipment(orderId, ward, slot);
      if (error) startTransition(() => setToast({ ok: false, text: error }));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className={label}>
        Phường / xã giao hàng
        <select value={ward} onChange={(e) => setWard(e.target.value)} disabled={pending} className={`${select} normal-case text-text-primary`}>
          <option value="">Chọn phường / xã</option>
          {wards.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <span className="normal-case">Khách nhập: {typedWard || "—"}</span>
      </label>
      <label className={label}>
        Thời gian lấy hàng
        <select value={slot} onChange={(e) => setSlot(e.target.value)} disabled={pending} className={`${select} normal-case text-text-primary`}>
          {slots.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={create} disabled={pending || !ward} className={`${button} bg-accent text-text-on-dark enabled:hover:bg-accent-hover`}>
        {pending ? "Đang tạo…" : "Tạo đơn SPX"}
      </button>
      <Toast toast={toast} setToast={setToast} />
    </div>
  );
}

// IN PHIẾU: the tab is opened inside the click (so popup blockers allow it), then pointed
// at the fresh label link once SPX returns it.
export function SpxLabelButton({ orderId }: { orderId: string }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function print() {
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const { url, error } = await getSpxLabel(orderId);
      if (url && tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        tab?.close();
        setToast({ ok: false, text: error ?? "Trình duyệt đã chặn cửa sổ mới. Cho phép cửa sổ bật lên rồi thử lại." });
      }
    });
  }

  return (
    <>
      <button type="button" onClick={print} disabled={pending} className={`${button} border border-text-primary enabled:hover:bg-text-primary enabled:hover:text-text-on-dark`}>
        {pending ? "Đang lấy phiếu…" : "In phiếu"}
      </button>
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
