"use client";

import Link from "next/link";
import { createContext, useContext, useState, useTransition } from "react";
import { createSpxShipments, getSpxLabels, type BulkResult } from "@/app/(shell)/orders/[number]/actions";

// Bulk SPX on /orders (DASHBOARD_DESIGN.md §6.2 "List → bulk SPX"): row checkboxes + a sticky bar.
type Selection = { selected: Set<string>; set: (ids: string[], on: boolean) => void; clear: () => void };
const SelectionContext = createContext<Selection | null>(null);

function useSelection() {
  const s = useContext(SelectionContext);
  if (!s) throw new Error("BulkProvider missing");
  return s;
}

export function BulkProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const set = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  return <SelectionContext value={{ selected, set, clear: () => setSelected(new Set()) }}>{children}</SelectionContext>;
}

// Sits above the row's stretched link (relative z-10) so ticking doesn't open the order.
export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, set } = useSelection();
  return (
    <label className="relative z-10 flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" aria-label={`Chọn ${label}`} checked={selected.has(id)} onChange={(e) => set([id], e.target.checked)} className="size-5 accent-text-primary" />
    </label>
  );
}

export function AllCheckbox({ ids }: { ids: string[] }) {
  const { selected, set } = useSelection();
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  return (
    <label className="flex size-11 cursor-pointer items-center justify-center">
      <input type="checkbox" aria-label="Chọn tất cả đơn trên trang" checked={all} onChange={(e) => set(ids, e.target.checked)} className="size-5 accent-text-primary" />
    </label>
  );
}

const button = "h-10 rounded-sm px-4 text-button uppercase transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";
const select =
  "h-10 w-full rounded-sm border border-border bg-surface px-2 text-base md:text-input focus:border-text-primary focus:outline-none disabled:opacity-50 sm:w-auto";

// mode "create": slots undefined = still loading, null = SPX didn't answer.
export function BulkBar({ mode, slots }: { mode: "create" | "print"; slots?: { value: string; label: string }[] | null }) {
  const { selected, clear } = useSelection();
  const [slot, setSlot] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = [...selected];
  const pickup = slot || slots?.[0]?.value || "";

  function run() {
    // Opened inside the click so popup blockers allow it; pointed at the label once SPX answers.
    const tab = window.open("", "_blank");
    startTransition(async () => {
      const r = mode === "create" ? await createSpxShipments(ids, pickup) : await getSpxLabels(ids);
      if (r.url && tab) {
        tab.opener = null;
        tab.location.href = r.url;
      } else tab?.close();
      startTransition(() => {
        setResult(r);
        clear();
      });
    });
  }

  if (result) return <ResultPanel mode={mode} result={result} close={() => setResult(null)} />;
  if (!ids.length) return null;

  return (
    <div className="sticky bottom-0 z-20 -mx-6 flex flex-col gap-3 border-t border-border bg-surface p-4 shadow-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold">Đã chọn {ids.length} đơn</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {mode === "create" && (
          slots === null ? (
            <p className="text-accent">Không tải được giờ lấy hàng từ SPX. Tải lại trang để thử lại.</p>
          ) : (
            <select aria-label="Thời gian lấy hàng" value={pickup} onChange={(e) => setSlot(e.target.value)} disabled={pending || !slots} className={select}>
              {!slots && <option value="">Đang tải giờ lấy hàng…</option>}
              {slots?.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )
        )}
        <button
          type="button"
          onClick={run}
          disabled={pending || (mode === "create" && !pickup)}
          className={`${button} bg-accent text-text-on-dark enabled:hover:bg-accent-hover`}
        >
          {pending ? (mode === "create" ? "Đang tạo…" : "Đang lấy phiếu…") : mode === "create" ? `Tạo đơn SPX & in phiếu (${ids.length})` : `In phiếu (${ids.length})`}
        </button>
      </div>
    </div>
  );
}

function ResultPanel({ mode, result, close }: { mode: "create" | "print"; result: BulkResult; close: () => void }) {
  return (
    <div role="status" className="sticky bottom-0 z-20 -mx-6 flex flex-col gap-2 border-t border-border bg-surface p-4 shadow-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {mode === "create" && <p className="font-semibold">Đã tạo {result.created} vận đơn</p>}
          {result.url && (
            <a href={result.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-accent">
              Mở phiếu gửi hàng (hiệu lực 30 phút)
            </a>
          )}
          {result.error && <p className="text-accent">{result.error}</p>}
        </div>
        <button type="button" onClick={close} className={`${button} shrink-0 text-text-secondary enabled:hover:text-text-primary`}>Đóng</button>
      </div>
      {result.failed.length > 0 && (
        <ul className="flex flex-col gap-1">
          {result.failed.map((f) => (
            <li key={f.orderNumber}>
              <Link href={`/orders/${f.orderNumber}`} className="font-semibold underline underline-offset-2 hover:text-accent">{f.orderNumber}</Link>
              <span className="text-text-secondary"> — {f.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
