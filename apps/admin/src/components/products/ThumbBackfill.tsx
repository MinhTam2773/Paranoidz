"use client";

import { useState } from "react";
import { listMissingThumbs } from "@/app/(shell)/products/[id]/image-actions";
import { uploadThumbs } from "@/lib/upload-thumbs";
import { Toast, type ToastMessage } from "../Toast";

// Makes the storefront thumbnails that are missing (photos from before 2026-10-31, or a failed
// thumbnail upload): each original is downloaded once and resized in the browser.
export function ThumbBackfill() {
  const [progress, setProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  async function run() {
    setProgress("Đang kiểm tra…");
    try {
      const jobs = await listMissingThumbs();
      let failed = 0;
      for (const [i, job] of jobs.entries()) {
        setProgress(`Đang tạo ${i + 1}/${jobs.length}…`);
        const res = await fetch(job.url);
        const done = res.ok ? await uploadThumbs(job.productId, job.path, await res.blob()) : { error: "fetch" };
        if (done.error) failed++;
      }
      setToast(
        !jobs.length ? { ok: true, text: "Ảnh thu nhỏ đã đủ" }
        : failed ? { ok: false, text: `Đã tạo ${jobs.length - failed} ảnh, ${failed} ảnh lỗi. Bấm lại để thử tiếp.` }
        : { ok: true, text: `Đã tạo ảnh thu nhỏ cho ${jobs.length} ảnh` },
      );
    } catch {
      setToast({ ok: false, text: "Không thể tạo ảnh thu nhỏ. Vui lòng thử lại." });
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <button
        type="button" onClick={run} disabled={progress !== null}
        className="flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark disabled:opacity-50 md:flex-none"
      >
        {progress ?? "Ảnh thu nhỏ"}
      </button>
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
