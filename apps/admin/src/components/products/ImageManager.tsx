"use client";

import Image from "next/image";
import { useEffect, useOptimistic, useRef, useState, useTransition, type DragEvent } from "react";
import { createClient } from "@paranoidz/db/client";
import {
  addProductImage,
  createImageUpload,
  deleteProductImage,
  reorderProductImages,
  setImageColor,
} from "@/app/(shell)/products/[id]/image-actions";
import { Toast, type ToastMessage } from "../Toast";
import { compressImage, IMAGE_CACHE_SECONDS } from "@/lib/compress-image";
import { uploadThumbs } from "@/lib/upload-thumbs";

export type ProductImage = { id: string; url: string; color: string | null };

const select =
  "h-10 w-full rounded-sm border border-border bg-surface px-2 text-base md:text-input focus:border-text-primary focus:outline-none disabled:opacity-50";
// 44px touch targets on mobile, 40px from md (DASHBOARD_DESIGN.md §5 buttons).
const iconButton =
  "flex size-11 items-center justify-center rounded-sm text-text-secondary hover:text-text-primary disabled:opacity-30 md:size-10";

// DASHBOARD_DESIGN.md §5 Image uploader. Images arrive sorted; position 1 is the
// cover (★). Renders from server props; useOptimistic shows reorder / colour
// changes at once while the server action runs.
export function ImageManager({ productId, productName, images, colors }: {
  productId: string;
  productName: string;
  images: ProductImage[];
  colors: string[];
}) {
  const [optimistic, setOptimistic] = useOptimistic(images);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [newColor, setNewColor] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [confirming, setConfirming] = useState<ProductImage | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = pending || progress !== null;

  useEffect(() => {
    if (confirming) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [confirming]);

  // Signed URL from the server → bytes straight to Storage → register the row.
  async function uploadOne(original: File): Promise<{ error?: string }> {
    const { file } = await compressImage(original);
    const ticket = await createImageUpload(productId, file.type, file.size);
    if ("error" in ticket) return ticket;
    const { error } = await createClient().storage.from("product-images").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, cacheControl: IMAGE_CACHE_SECONDS });
    if (error) return { error: "Tải lên thất bại." };
    await uploadThumbs(productId, ticket.path, file);
    return addProductImage(productId, ticket.path, newColor || null);
  }

  // Plain async, not a transition: progress must render as it changes, and each
  // photo appears when its server action revalidates. One batch at a time.
  async function upload(files: File[]) {
    if (!files.length || busy) return;
    let ok = 0;
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Đang tải ảnh ${i + 1}/${files.length}…`);
      const added = await uploadOne(file);
      if (added.error) failed.push(`${file.name}: ${added.error}`);
      else ok++;
    }
    setProgress(null);
    setToast(
      failed.length
        ? { ok: false, text: [ok ? `Đã thêm ${ok} ảnh.` : "", ...failed].filter(Boolean).join(" ") }
        : { ok: true, text: `Đã thêm ${ok} ảnh` },
    );
  }


  function run(next: ProductImage[], action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      setOptimistic(next);
      const { error } = await action();
      if (error) setToast({ ok: false, text: error });
    });
  }

  function move(id: string, to: number) {
    const from = optimistic.findIndex((i) => i.id === id);
    if (from === to || to < 0 || to >= optimistic.length) return;
    const next = [...optimistic];
    next.splice(to, 0, ...next.splice(from, 1));
    run(next, () => reorderProductImages(productId, next.map((i) => i.id)));
  }

  function recolor(id: string, color: string | null) {
    run(optimistic.map((i) => (i.id === id ? { ...i, color } : i)), () => setImageColor(productId, id, color));
  }

  function remove() {
    const target = confirming;
    if (!target) return;
    startTransition(async () => {
      const { error } = await deleteProductImage(productId, target.id);
      startTransition(() => {
        setConfirming(null);
        setToast(error ? { ok: false, text: error } : { ok: true, text: "Đã xóa ảnh" });
      });
    });
  }

  const isFileDrag = (e: DragEvent) => e.dataTransfer.types.includes("Files");

  return (
    <section className="flex flex-col gap-5 rounded-sm border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title uppercase">Ảnh sản phẩm</h2>
        <p className="text-stat-label text-text-secondary">
          Ảnh đầu tiên (★) là ảnh bìa trên cửa hàng. Ảnh gán màu hiện khi khách chọn màu đó; ảnh &quot;Chung&quot; hiện với mọi màu. Kéo để sắp xếp.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-2">
          <label htmlFor="new-image-color" className="text-label uppercase">Màu cho ảnh mới</label>
          <select id="new-image-color" value={newColor} onChange={(e) => setNewColor(e.target.value)} disabled={busy} className={select}>
            <option value="">Chung (mọi màu)</option>
            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div
          onDragOver={(e) => { if (isFileDrag(e)) { e.preventDefault(); setDropActive(true); } }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => { if (!isFileDrag(e)) return; e.preventDefault(); setDropActive(false); if (!busy) upload([...e.dataTransfer.files]); }}
          className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-4 text-center ${dropActive ? "border-text-primary bg-bg-secondary" : "border-border"}`}
        >
          {progress ? (
            <p role="status" className="text-text-secondary">{progress}</p>
          ) : (
            <>
              <p className="hidden text-text-secondary md:block">Kéo ảnh vào đây, hoặc</p>
              <button
                type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark disabled:opacity-50"
              >
                Chọn ảnh
              </button>
              <p className="text-stat-label text-text-muted">JPG, PNG, WebP · tối đa 10 MB · tỉ lệ 3:4 hiển thị đẹp nhất</p>
            </>
          )}
          <input
            ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }}
          />
        </div>
      </div>

      {optimistic.length === 0 ? (
        <p className="text-text-secondary">Chưa có ảnh. Sản phẩm không có ảnh sẽ hiện ô trống trên cửa hàng.</p>
      ) : (
        <ol className="flex flex-col">
          {optimistic.map((img, i) => (
            <li
              key={img.id}
              draggable={!busy}
              onDragStart={() => setDragId(img.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
              onDrop={(e) => { if (!dragId) return; e.preventDefault(); move(dragId, i); setDragId(null); }}
              className={`grid grid-cols-[80px_1fr] gap-3 border-b border-border py-3 md:grid-cols-[24px_80px_200px_1fr] md:items-center ${dragId === img.id ? "opacity-40" : ""} ${busy ? "" : "cursor-grab"}`}
            >
              <span className="hidden text-stat-label text-text-muted md:block">{i + 1}</span>
              <span className="relative size-20 overflow-hidden rounded-sm bg-bg-tertiary">
                <Image src={img.url} alt={`Ảnh ${i + 1}`} fill sizes="80px" className="object-cover" draggable={false} />
              </span>
              <select
                  aria-label={`Màu của ảnh ${i + 1}`} value={img.color ?? ""} disabled={busy}
                  onChange={(e) => recolor(img.id, e.target.value || null)}
                  className={`${select} self-start md:self-auto`}
                >
                  <option value="">Chung (mọi màu)</option>
                  {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                  {img.color && !colors.includes(img.color) && <option value={img.color}>{img.color} (không còn biến thể)</option>}
                </select>
                {/* Mobile: full width under the photo; md: last column. */}
                <div className="col-span-2 flex items-center gap-1 md:col-span-1 md:justify-end">
                  {i === 0 ? (
                    <span className="flex h-11 items-center gap-1 whitespace-nowrap px-2 text-label uppercase md:h-10"><span aria-hidden="true">★</span> Ảnh bìa</span>
                  ) : (
                    <button type="button" onClick={() => move(img.id, 0)} disabled={busy} aria-label={`Đặt ảnh ${i + 1} làm ảnh bìa`} title="Đặt làm ảnh bìa" className={iconButton}>☆</button>
                  )}
                  <button type="button" onClick={() => move(img.id, i - 1)} disabled={busy || i === 0} aria-label={`Đưa ảnh ${i + 1} lên`} className={iconButton}>↑</button>
                  <button type="button" onClick={() => move(img.id, i + 1)} disabled={busy || i === optimistic.length - 1} aria-label={`Đưa ảnh ${i + 1} xuống`} className={iconButton}>↓</button>
                  <button type="button" onClick={() => setConfirming(img)} disabled={busy} aria-label={`Xóa ảnh ${i + 1}`} className={`${iconButton} hover:text-accent`}>×</button>
                </div>
            </li>
          ))}
        </ol>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-image-title"
        onCancel={(e) => (pending ? e.preventDefault() : setConfirming(null))}
        className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-sm bg-surface p-6 text-text-primary shadow-2 backdrop:bg-bg-dark/50"
      >
        {confirming && (
          <div className="flex flex-col gap-4">
            <h2 id="delete-image-title" className="text-card-title uppercase">
              Xóa ảnh {optimistic.findIndex((i) => i.id === confirming.id) + 1} của {productName}?
            </h2>
            <div className="flex items-center gap-3">
              <span className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
                <Image src={confirming.url} alt="" fill sizes="80px" className="object-cover" />
              </span>
              <p className="text-text-secondary">Ảnh sẽ bị gỡ khỏi cửa hàng. Không thể hoàn tác.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirming(null)} disabled={pending} className="h-10 rounded-sm px-4 text-button uppercase text-text-secondary hover:text-text-primary disabled:opacity-50">
                Quay lại
              </button>
              <button type="button" onClick={remove} disabled={pending} className="h-10 rounded-sm border border-accent px-4 text-button uppercase text-accent transition-colors duration-200 enabled:hover:bg-accent enabled:hover:text-text-on-dark disabled:opacity-50">
                {pending ? "Đang xóa…" : "Xóa ảnh"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <Toast toast={toast} setToast={setToast} />
    </section>
  );
}
