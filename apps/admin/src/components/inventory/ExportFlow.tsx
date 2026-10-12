"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buildExport, confirmExport, type ExportBatch, type ExportFile } from "@/app/(shell)/inventory/export/actions";
import { Toast, type ToastMessage } from "../Toast";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function download(file: ExportFile) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX }));
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  a.click();
  URL.revokeObjectURL(url);
}

// TẢI FILE → upload in BigSeller → ĐÃ NHẬP VÀO BIGSELLER. Only the batch in the
// downloaded files is marked; anything that arrives after the download waits for the next one.
export function ExportFlow({ empty }: { empty: boolean }) {
  const router = useRouter();
  const [made, setMade] = useState<{ batch: ExportBatch; files: ExportFile[] } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function build() {
    startTransition(async () => {
      const res = await buildExport();
      if (!res.files.length) return setToast({ ok: false, text: "Không có gì để xuất." });
      res.files.forEach(download);
      setMade(res);
    });
  }

  function confirm() {
    if (!made) return;
    startTransition(async () => {
      const res = await confirmExport(made.batch);
      if (res.error) return setToast({ ok: false, text: res.error });
      setToast({ ok: true, text: "Đã đánh dấu đã gửi BigSeller" });
      setMade(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-5">
      <h2 className="text-card-title uppercase">Gửi sang BigSeller</h2>
      {!made ? (
        <div>
          <button
            type="button" onClick={build} disabled={pending || empty}
            className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Đang tạo file…" : "Tải file"}
          </button>
        </div>
      ) : (
        <>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {made.files.map((f) => (
              <li key={f.name}>
                <strong>{f.name}</strong> ({f.lines} SKU) —{" "}
                {f.name.includes("xuat-kho")
                  ? "BigSeller → Inventory → Manual Stock-Out → Import & Export → Import & Update, loại \"Stock-Out / Ordinary\"."
                  : "BigSeller → Inventory → Manual Stock-In → Import & Export → Import & Update, loại \"Stock-In / Ordinary\"."}{" "}
                <button type="button" onClick={() => download(f)} className="underline">Tải lại</button>
              </li>
            ))}
            <li>Khi BigSeller đã nhận đủ các file trên (không báo lỗi dòng nào), bấm nút dưới đây. Nếu BigSeller báo lỗi, sửa rồi tải file lại — đừng bấm.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={confirm} disabled={pending}
              className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Đang lưu…" : "Đã nhập vào BigSeller"}
            </button>
            <button type="button" onClick={() => setMade(null)} disabled={pending} className="h-10 px-4 text-button uppercase text-text-secondary hover:text-text-primary">Hủy</button>
          </div>
        </>
      )}
      <Toast toast={toast} setToast={setToast} />
    </section>
  );
}
