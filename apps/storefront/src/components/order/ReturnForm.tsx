"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { uploadWithTicket } from "@paranoidz/db/media";
import type { LookedUpOrder } from "@/app/order-lookup/actions";
import { createReturnPhotoUpload, submitReturn } from "@/app/order-lookup/return-actions";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import {
  MAX_RETURN_NOTE, MAX_RETURN_PHOTO_BYTES, MAX_RETURN_PHOTOS, RETURN_PHOTO_TYPES, RETURN_REASONS, type ReturnReason,
} from "@/lib/return-status";

const inputClass =
  "w-full rounded-sm border border-border bg-bg-primary px-3 py-3 text-base text-text-primary lg:text-product-name placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";
const primaryClass =
  "h-12 w-full rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:hover:shadow-accent disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted";
const secondaryClass =
  "flex h-12 w-full items-center justify-center rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark";
const labelClass = "text-nav uppercase text-text-secondary";

// Return request (ARCHITECTURE.md §4 "Returns"). Order number + phone come from the lookup that
// opened the form and stay in memory; photos go browser → storage first, then the request.
export function ReturnForm({
  order,
  phone,
  onDone,
  onCancel,
}: {
  order: LookedUpOrder;
  phone: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const lines = order.items.filter((i) => i.returnable > 0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [note, setNote] = useState("");
  const [notWashed, setNotWashed] = useState(false);
  const [tagsAttached, setTagsAttached] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(files: File[]) {
    const ok = files.filter((f) => Object.hasOwn(RETURN_PHOTO_TYPES, f.type) && f.size <= MAX_RETURN_PHOTO_BYTES);
    setError(ok.length < files.length ? "Chỉ nhận ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB." : null);
    setPhotos((prev) => [...prev, ...ok].slice(0, MAX_RETURN_PHOTOS));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const items = Object.entries(qty).filter(([, n]) => n > 0).map(([orderItemId, n]) => ({ orderItemId, qty: n }));
    const problem = !items.length ? "Chọn ít nhất một sản phẩm muốn trả."
      : !reason ? "Chọn lý do trả hàng."
      : reason === "other" && !note.trim() ? "Ghi rõ lý do trả hàng."
      : !notWashed || !tagsAttached ? "Sản phẩm trả phải chưa giặt và còn nguyên tem mác. Vui lòng xác nhận cả hai."
      : !photos.length ? "Thêm ít nhất 1 ảnh sản phẩm thấy rõ tem mác."
      : null;
    setError(problem);
    if (problem) return;

    startTransition(async () => {
      const paths: string[] = [];
      for (const file of photos) {
        const ticket = await createReturnPhotoUpload(order.orderNumber, phone, file.type, file.size);
        if (!ticket.ok) return setError(ticket.message);
        const { error: uploadError } = await uploadWithTicket("return-images", ticket.ticket, file, { contentType: file.type });
        if (uploadError) return setError("Tải ảnh lên thất bại. Vui lòng thử lại.");
        paths.push(ticket.ticket.path);
      }
      const res = await submitReturn({
        orderNumber: order.orderNumber, phone, reason: reason!, note, notWashed, tagsAttached, items, photos: paths,
      });
      if (res.ok) onDone();
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="return-heading" className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="return-heading" className="text-h3 uppercase">Yêu cầu trả hàng</h2>
        <p className="text-text-secondary">
          Đơn <strong className="text-text-primary">{order.orderNumber}</strong>. Sản phẩm trả phải chưa giặt, chưa qua sử dụng và còn nguyên tem mác.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelClass} mb-2`}>Sản phẩm muốn trả</legend>
        {lines.map((line) => {
          const picked = (qty[line.id] ?? 0) > 0;
          const variant = [line.color, line.size].filter(Boolean).join(" / ");
          return (
            <div key={line.id} className={`flex flex-wrap items-center gap-3 rounded-sm border p-3 ${picked ? "border-text-primary" : "border-border"}`}>
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={picked}
                  onChange={() => setQty((q) => ({ ...q, [line.id]: picked ? 0 : 1 }))}
                  className="size-5 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-product-name">{line.name}</span>
                  <span className="block text-caption text-text-secondary">
                    {variant ? `${variant} · ` : ""}Có thể trả {line.returnable}
                  </span>
                </span>
              </label>
              {picked && line.returnable > 1 && (
                <QuantityStepper
                  value={qty[line.id]}
                  max={line.returnable}
                  onChange={(n) => setQty((q) => ({ ...q, [line.id]: n }))}
                  label={`Số lượng trả: ${line.name}`}
                />
              )}
            </div>
          );
        })}
        {order.items.some((i) => i.isGift) && (
          <p className="text-caption text-text-secondary">Quà tặng kèm đơn (nếu có) vui lòng gửi lại cùng sản phẩm.</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-2`}>Lý do</legend>
        {RETURN_REASONS.map((r) => (
          <label key={r.value} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} className="size-5 shrink-0 accent-accent" />
            <span>{r.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="return-note" className={labelClass}>
          Mô tả {reason === "other" ? "(bắt buộc)" : "(không bắt buộc)"}
        </label>
        <textarea
          id="return-note"
          rows={3}
          maxLength={MAX_RETURN_NOTE}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: đường may ở tay áo bị bung"
          className={inputClass}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-2`}>Xác nhận tình trạng sản phẩm</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={notWashed} onChange={(e) => setNotWashed(e.target.checked)} className="size-5 shrink-0 accent-accent" />
          <span>Sản phẩm chưa giặt, chưa qua sử dụng</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={tagsAttached} onChange={(e) => setTagsAttached(e.target.checked)} className="size-5 shrink-0 accent-accent" />
          <span>Sản phẩm còn nguyên tem mác, chưa tháo</span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Ảnh sản phẩm ({photos.length}/{MAX_RETURN_PHOTOS})</span>
        <p className="text-caption text-text-secondary">Chụp rõ sản phẩm và tem mác. Tối đa {MAX_RETURN_PHOTOS} ảnh, mỗi ảnh tối đa 5 MB.</p>
        {photos.length > 0 && (
          <ul className="flex flex-col gap-1">
            {photos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 text-caption">
                <span className="min-w-0 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="min-h-11 shrink-0 px-2 text-nav uppercase text-text-secondary underline hover:text-accent"
                >
                  Bỏ
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_RETURN_PHOTOS && (
          <button type="button" onClick={() => fileRef.current?.click()} className={`${secondaryClass} max-w-xs`}>
            Thêm ảnh
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={Object.keys(RETURN_PHOTO_TYPES).join(",")}
          multiple
          hidden
          data-testid="return-photos"
          onChange={(e) => {
            pick([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      <div className="rounded-sm border border-border bg-bg-secondary p-4 text-caption text-text-secondary">
        Sau khi duyệt, shop gửi SPX đến lấy hàng tại địa chỉ giao hàng và trả phí vận chuyển. Shop kiểm tra hàng khi nhận lại;
        tiền hoàn được chuyển khoản trong 3–5 ngày làm việc. Muốn đổi size / đổi mẫu, vui lòng gọi hotline.
      </div>

      {error && <p role="alert" className="text-caption text-accent">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={pending} className={primaryClass}>
          {pending ? "Đang gửi…" : "Gửi yêu cầu"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={secondaryClass}>
          Quay lại
        </button>
      </div>
    </form>
  );
}
