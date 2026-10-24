"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@paranoidz/db/client";
import { renameColor, setColorHex } from "@/app/(shell)/products/actions";
import { addProductImage, createImageUpload } from "@/app/(shell)/products/[id]/image-actions";
import { Toast, type ToastMessage } from "../Toast";

const input =
  "h-10 w-full rounded-sm border border-border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";

type Color = { name: string; hex: string | null };
type ColorImage = { color: string | null; url: string };

// Rename a colour and pick its swatch on all its sizes at once
// (DASHBOARD_DESIGN.md §6.3). Saved on its own, outside the product form; the page reloads
// with the new values. The hex is saved under the old name first, so a rename carries it.
// This section is ONLY for variant photos: each row uploads that colour's photo
// (the thumbnail shown on the storefront card and the PDP colour button). General
// photos and the video live in the Ảnh sản phẩm section above.
export function ColorRename({ productId, colors, images }: { productId: string; colors: Color[]; images: ColorImage[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Color>>(() => Object.fromEntries(colors.map((c) => [c.name, c])));
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  if (!colors.length) return null;

  const edit = (name: string, patch: Partial<Color>) => setEdits((e) => ({ ...e, [name]: { ...e[name], ...patch } }));

  // Same signed-upload path as Ảnh sản phẩm: bytes go browser → Storage, then
  // the row is registered with this colour. The page reloads with the new photo.
  async function uploadColorImage(colorName: string, file: File) {
    if (uploading) return;
    setUploading(colorName);
    const ticket = await createImageUpload(productId, file.type, file.size);
    if ("error" in ticket) {
      setToast({ ok: false, text: ticket.error ?? "Không thể tải ảnh lên." });
      setUploading(null);
      return;
    }
    const { error } = await createClient().storage.from("product-images").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
    if (error) {
      setToast({ ok: false, text: "Tải lên thất bại." });
      setUploading(null);
      return;
    }
    const res = await addProductImage(productId, ticket.path, colorName);
    setToast(res.error ? { ok: false, text: res.error } : { ok: true, text: `Đã thêm ảnh cho màu "${colorName}"` });
    setUploading(null);
    router.refresh();
  }

  function save(c: Color) {
    const to = edits[c.name].name.trim();
    const hex = edits[c.name].hex;
    startTransition(async () => {
      if (hex !== c.hex) {
        const res = await setColorHex(productId, c.name, hex);
        if (res.error) return setToast({ ok: false, text: res.error });
      }
      if (to !== c.name) {
        const res = await renameColor(productId, c.name, to);
        if (res.error) return setToast({ ok: false, text: res.error });
      }
      setToast({ ok: true, text: `Đã lưu màu "${to}"` });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title uppercase">Màu sắc</h2>
        <p className="text-stat-label text-text-secondary">Đổi tên màu, chọn màu hiển thị (chấm màu trên thẻ sản phẩm) và tải ảnh phân loại cho mọi size của màu đó. Mục này chỉ đăng hình phân loại; hình/video chung của sản phẩm đăng ở mục Ảnh sản phẩm phía trên. SKU không đổi; đơn hàng cũ giữ tên màu lúc đặt. Lưu các thay đổi bên dưới trước — trang sẽ tải lại.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {colors.map((c) => {
          const { name, hex } = edits[c.name];
          const unchanged = (name.trim() === c.name && hex === c.hex) || !name.trim();
          const photo = images.find((i) => i.color === c.name)?.url ?? null;
          return (
            <li key={c.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 md:grid-cols-[160px_auto_1fr_auto]">
              <span className="col-span-3 font-medium wrap-break-word md:col-span-1">{c.name}</span>
              <div className="flex items-center gap-2">
                {photo && (
                  <Image src={photo} alt={`Ảnh phân loại ${c.name}`} width={40} height={40} className="size-10 rounded-sm border border-border object-cover" />
                )}
                <label className="cursor-pointer whitespace-nowrap px-1 text-stat-label text-text-secondary underline underline-offset-2 hover:text-text-primary">
                  {uploading === c.name ? "Đang tải…" : photo ? "Đổi ảnh" : "Tải ảnh"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadColorImage(c.name, file);
                    }}
                    className="sr-only"
                  />
                </label>
                {/* Native picker behind a circle: dashed while no colour is chosen. */}
                <label
                  className={`relative size-10 cursor-pointer rounded-full border ${hex ? "border-border" : "border-dashed border-text-muted"}`}
                  style={hex ? { backgroundColor: hex } : undefined}
                >
                  <span className="sr-only">Màu hiển thị cho {c.name}</span>
                  <input
                    type="color" value={hex ?? "#000000"}
                    onChange={(e) => edit(c.name, { hex: e.target.value.toLowerCase() })}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
              <label className="sr-only" htmlFor={`color-${c.name}`}>Tên mới cho màu {c.name}</label>
              <input
                id={`color-${c.name}`} value={name} maxLength={40}
                onChange={(e) => edit(c.name, { name: e.target.value })}
                className={input}
              />
              <button
                type="button" disabled={pending || unchanged} onClick={() => save(c)}
                className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lưu
              </button>
            </li>
          );
        })}
      </ul>
      <Toast toast={toast} setToast={setToast} />
    </section>
  );
}
