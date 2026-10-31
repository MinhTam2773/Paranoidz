"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { saveProduct } from "@/app/(shell)/products/actions";
import { createDescriptionImageUpload, createVideoUpload } from "@/app/(shell)/products/[id]/image-actions";
import { createClient } from "@paranoidz/db/client";
import { compressImage, IMAGE_CACHE_SECONDS } from "@/lib/compress-image";
import { slugify, validateProduct, type FieldErrors, type ProductInput, type VariantInput } from "@/lib/product";
import { Toast, type ToastMessage } from "../Toast";

// DASHBOARD_DESIGN.md §5 Forms: labels above, 40px inputs, 16px below md (iOS zoom).
const input =
  "h-10 w-full rounded-sm border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none disabled:bg-bg-secondary disabled:text-text-secondary";
const label = "text-label uppercase";
const card = "flex flex-col gap-5 rounded-sm border border-border bg-surface p-5";
const cardTitle = "text-card-title uppercase";

type Category = { id: string; name: string };

// Full-page create / edit (no modal CRUD, §7). `version` changes whenever the saved
// data does, which remounts the form with fresh values (new variant ids, stock for
// the compare-and-set). The toast and the form-level message live here, above that
// key, so they survive it — e.g. "stock changed, reloaded" arrives with the remount.
export function ProductEditor({ initial, categories, version }: { initial: ProductInput; categories: Category[]; version: string }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-6">
      {notice && <p role="alert" tabIndex={-1} className="rounded-sm border border-accent bg-surface p-4 text-accent">{notice}</p>}
      <ProductForm
        key={version}
        initial={initial}
        categories={categories}
        setNotice={setNotice}
        onSaved={() => setToast({ ok: true, text: "Đã lưu sản phẩm" })}
      />
      <Toast toast={toast} setToast={setToast} />
    </div>
  );
}

// Everything is re-validated by saveProduct.
function ProductForm({ initial, categories, setNotice, onSaved }: {
  initial: ProductInput;
  categories: Category[];
  setNotice: (notice: string | null) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const creating = !initial.id;
  const [form, setForm] = useState(initial);
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);
  const descFileRef = useRef<HTMLInputElement>(null);
  const [descUploading, setDescUploading] = useState(false);

  // Description images (2026-10-17): upload to product-images/products/{slug}/desc/
  // and insert an <img> tag at the cursor. Editing-only — a new product has no
  // slug folder until it is saved once.
  async function insertDescriptionImage(original: File) {
    if (!initial.id) return;
    setDescUploading(true);
    try {
      const { file, width, height } = await compressImage(original);
      const ticket = await createDescriptionImageUpload(initial.id, file.type, file.size);
      if ("error" in ticket) {
        setNotice(ticket.error ?? "Không thể tải ảnh lên.");
        return;
      }
      const { error } = await createClient()
        .storage.from("product-images")
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, cacheControl: IMAGE_CACHE_SECONDS });
      if (error) {
        setNotice("Không thể tải ảnh lên. Vui lòng thử lại.");
        return;
      }
      // width / height reserve the space on the storefront before the image loads (no layout shift).
      const tag = `<img src="${ticket.publicUrl}" alt="" width="${width}" height="${height}">`;
      const el = descRef.current;
      if (el) {
        const s = el.selectionStart ?? form.description.length;
        const e = el.selectionEnd ?? s;
        set("description", form.description.slice(0, s) + tag + form.description.slice(e));
        requestAnimationFrame(() => {
          el.focus();
          el.selectionStart = el.selectionEnd = s + tag.length;
        });
      } else {
        set("description", form.description + tag);
      }
    } finally {
      setDescUploading(false);
    }
  }

  const videoFileRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  // Product video (2026-10-30): upload to product-images/products/{slug}/video/ and fill the
  // video URL field; it is stored when the form is saved. Editing-only, like description images.
  async function uploadVideo(file: File) {
    if (!initial.id) return;
    setVideoUploading(true);
    try {
      const ticket = await createVideoUpload(initial.id, file.type, file.size);
      if ("error" in ticket) {
        setNotice(ticket.error ?? "Không thể tải video lên.");
        return;
      }
      const { error } = await createClient()
        .storage.from("product-images")
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, cacheControl: IMAGE_CACHE_SECONDS });
      if (error) {
        setNotice("Không thể tải video lên. Vui lòng thử lại.");
        return;
      }
      set("videoUrl", ticket.publicUrl);
    } finally {
      setVideoUploading(false);
    }
  }

  // Editing a field clears its error; the rest stay until the next submit.
  const clearErrors = (...keys: string[]) =>
    setErrors((e) => (keys.some((k) => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) : e));
  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearErrors(key);
  };
  const setVariant = (i: number, patch: Partial<VariantInput>) => {
    setForm((f) => ({ ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
    clearErrors(...Object.keys(patch).map((f) => `variants.${i}.${f}`));
  };

  function onName(name: string) {
    setForm((f) => ({ ...f, name, slug: creating && !slugEdited ? slugify(name) : f.slug }));
    clearErrors("name", ...(creating && !slugEdited ? ["slug"] : []));
  }

  // Colour × size matrix: adds every missing combination, priced like the first row.
  function addVariants() {
    // Case-insensitive dedupe keeping the first spelling: "S, s" is one size.
    const list = (s: string) =>
      s.split(",").map((x) => x.trim()).filter((x, i, all) => x && all.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
    const [cs, ss] = [list(colors), list(sizes)];
    if (!cs.length || !ss.length) return setErrors((e) => ({ ...e, matrix: "Nhập ít nhất một màu và một size." }));
    const has = new Set(form.variants.filter((v) => !v.removed).map((v) => `${v.color.toLowerCase()}|${v.size.toLowerCase()}`));
    const base = form.variants.find((v) => !v.removed);
    const added = cs.flatMap((color) =>
      ss.filter((size) => !has.has(`${color.toLowerCase()}|${size.toLowerCase()}`)).map((size) => ({
        color, size, price: base?.price ?? "", originalPrice: base?.originalPrice ?? "", stock: "0", sku: "",
      })),
    );
    set("variants", [...form.variants, ...added]);
    setColors("");
    setSizes("");
    clearErrors("matrix", "variants");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const local = validateProduct(form).errors;
    setErrors(local);
    setNotice(null);
    if (Object.keys(local).length) return focusFirstError(local);
    startTransition(async () => {
      const res = await saveProduct(form);
      startTransition(() => {
        if (res.errors) {
          const { form: formError, ...fieldErrors } = res.errors;
          setErrors(fieldErrors);
          setNotice(formError ?? null);
          focusFirstError(res.errors);
        } else if (creating) {
          router.push(`/products/${res.id}`);
        } else {
          onSaved();
        }
      });
    });
  }

  const err = (key: string) => errors[key] && <p id={`${key}-error`} className="text-stat-label text-accent">{errors[key]}</p>;
  const aria = (key: string) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `${key}-error` : undefined });
  const border = (key: string) => (errors[key] ? "border-accent" : "border-border");

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <section className={card}>
        <h2 className={cardTitle}>Thông tin</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="name" label="Tên sản phẩm" error={err("name")}>
            <input id="name" value={form.name} onChange={(e) => onName(e.target.value)} maxLength={120} className={`${input} ${border("name")}`} {...aria("name")} />
          </Field>
          <Field id="slug" label="Đường dẫn (slug)" error={err("slug")} hint={creating ? "Tự tạo từ tên. Không đổi được sau khi tạo." : "Không đổi được sau khi tạo (đường dẫn và ảnh dùng slug)."}>
            <input
              id="slug" value={form.slug} disabled={!creating} maxLength={80}
              onChange={(e) => { setSlugEdited(true); set("slug", e.target.value); }}
              className={`${input} ${border("slug")}`} {...aria("slug")}
            />
          </Field>
          <Field id="categoryId" label="Danh mục" error={err("categoryId")}>
            <select id="categoryId" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={`${input} ${border("categoryId")}`} {...aria("categoryId")}>
              <option value="">— Không có —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="flex flex-col gap-2">
            <span className={label}>Trạng thái</span>
            <label className="flex h-10 items-center gap-3">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="size-5 accent-text-primary" />
              Đang bán (hiển thị trên cửa hàng)
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <span className={label}>Ưu đãi đơn hàng</span>
            <label className="flex h-10 items-center gap-3">
              <input type="checkbox" checked={form.earnsPerks} onChange={(e) => set("earnsPerks", e.target.checked)} aria-describedby="earnsPerks-hint" className="size-5 accent-text-primary" />
              Được tặng tất
            </label>
            <p id="earnsPerks-hint" className="text-stat-label text-text-secondary">Đơn có từ 1 sản phẩm được tích: tặng 1 đôi tất. Bỏ tích cho tất, balo, túi, phụ kiện, quà tặng. Miễn phí ship không phụ thuộc mục này: mọi đơn giao thường từ ₫199.000 (sau mã giảm giá).</p>
          </div>
          <Field id="description" label="Mô tả" error={err("description")} wide hint="Hỗ trợ ảnh và định dạng cơ bản (xuống dòng, in đậm, gạch đầu dòng).">
            <textarea ref={descRef} id="description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} maxLength={20000} className={`${input} h-auto py-2 ${border("description")}`} {...aria("description")} />
            {!creating && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={descUploading}
                  onClick={() => descFileRef.current?.click()}
                  className="h-9 rounded-sm border border-border px-4 text-button uppercase transition-colors duration-200 hover:border-text-primary hover:text-text-primary disabled:opacity-50"
                >
                  {descUploading ? "Đang tải…" : "Chèn ảnh"}
                </button>
                <input
                  ref={descFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) insertDescriptionImage(f);
                  }}
                />
                <span className="text-stat-label text-text-secondary">Ảnh chèn vào vị trí con trỏ trong mô tả.</span>
              </div>
            )}
          </Field>
          <Field id="careInstructions" label="Hướng dẫn bảo quản" error={err("careInstructions")} wide>
            <textarea id="careInstructions" value={form.careInstructions} onChange={(e) => set("careInstructions", e.target.value)} rows={2} maxLength={1000} className={`${input} h-auto py-2 ${border("careInstructions")}`} {...aria("careInstructions")} />
          </Field>
          <Field id="sizeGuide" label="Bảng size" error={err("sizeGuide")} wide hint="Dòng đầu là các size, mỗi dòng sau là một số đo: &quot;Size: S, M, L&quot; rồi &quot;Ngực (cm): 52, 55, 58&quot;. Để trống nếu không có.">
            <textarea id="sizeGuide" value={form.sizeGuide} onChange={(e) => set("sizeGuide", e.target.value)} rows={4} placeholder={"Size: S, M, L\nNgực (cm): 52, 55, 58\nDài (cm): 70, 72, 74"} className={`${input} h-auto py-2 font-[inherit] placeholder:text-text-muted ${border("sizeGuide")}`} {...aria("sizeGuide")} />
          </Field>
          <Field id="shopeeSoldCount" label="Lượt bán Shopee" hint="Số lượt bán trên Shopee, hiện trên card dạng &quot;Đã bán X&quot;. Shopee không cho đồng bộ tự động nên nhập tay.">
            <input id="shopeeSoldCount" type="number" min={0} step={1} value={form.shopeeSoldCount} onChange={(e) => set("shopeeSoldCount", Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={input} />
          </Field>
          <Field id="giftLabel" label="Quà tặng kèm" hint='Hiện badge "🎁 ..." trên card, ví dụ "Quà tặng kèm". Để trống nếu không có. Quà do shop tự bỏ vào đơn khi đóng gói.'>
            <input id="giftLabel" value={form.giftLabel} onChange={(e) => set("giftLabel", e.target.value)} maxLength={40} placeholder="Quà tặng kèm" className={input} />
          </Field>
          <Field id="videoUrl" label="Video sản phẩm" hint="Tải video MP4 / WebM (tối đa 50 MB) hoặc dán đường dẫn công khai. Để trống nếu không có video. Video hiện ở ô đầu gallery trang chi tiết, khách bấm ▶ mới tải và phát (không tiếng, có nút bật tiếng). Bấm Lưu để lưu video.">
            <input id="videoUrl" value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} maxLength={500} placeholder="https://..." className={input} />
            {!creating && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={videoUploading}
                  onClick={() => videoFileRef.current?.click()}
                  className="h-9 rounded-sm border border-border px-4 text-button uppercase transition-colors duration-200 hover:border-text-primary hover:text-text-primary disabled:opacity-50"
                >
                  {videoUploading ? "Đang tải…" : "Tải video"}
                </button>
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) uploadVideo(f);
                  }}
                />
              </div>
            )}
          </Field>
          <Field id="videoPosterUrl" label="Ảnh bìa video" hint="Ảnh hiện trước khi video phát và làm thumbnail video. Để trống thì lấy ảnh sản phẩm đầu tiên.">
            <input id="videoPosterUrl" value={form.videoPosterUrl} onChange={(e) => set("videoPosterUrl", e.target.value)} maxLength={500} placeholder="https://..." className={input} />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h2 className={cardTitle}>Biến thể</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field id="matrix-colors" label="Màu" hint="Cách nhau bằng dấu phẩy">
            <input id="matrix-colors" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Đen, Trắng" className={`${input} border-border placeholder:text-text-muted`} />
          </Field>
          <Field id="matrix-sizes" label="Size" hint="Cách nhau bằng dấu phẩy">
            <input id="matrix-sizes" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L, XL" className={`${input} border-border placeholder:text-text-muted`} />
          </Field>
          <button type="button" onClick={addVariants} className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark md:mb-6">
            Thêm biến thể
          </button>
        </div>
        {err("matrix")}
        {err("variants")}

        {form.variants.length > 0 && (
          <div className="flex flex-col">
            <div aria-hidden="true" className="hidden grid-cols-[1fr_70px_120px_120px_90px_1fr_44px] gap-2 border-b border-border pb-2 text-th uppercase text-text-secondary md:grid">
              <span>Màu</span><span>Size</span><span>Giá bán</span><span>Giá gốc</span><span>Tồn kho</span><span>SKU</span><span />
            </div>
            {form.variants.map((v, i) => {
              const k = (f: string) => `variants.${i}.${f}`;
              const cell = (f: keyof VariantInput, labelText: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
                <div className="flex flex-col gap-1">
                  <label htmlFor={k(f)} className="text-stat-label uppercase text-text-secondary md:sr-only">{labelText}</label>
                  <input
                    id={k(f)} value={String(v[f] ?? "")} disabled={v.removed}
                    onChange={(e) => setVariant(i, { [f]: e.target.value })}
                    className={`${input} ${border(k(f))}`} {...aria(k(f))} {...props}
                  />
                  {err(k(f))}
                </div>
              );
              return (
                <div key={v.id ?? `new-${i}`} className={`grid grid-cols-2 gap-2 border-b border-border py-3 md:grid-cols-[1fr_70px_120px_120px_90px_1fr_44px] md:items-start ${v.removed ? "opacity-50" : ""}`}>
                  {v.id ? (
                    <>
                      <span className="flex h-10 items-center font-medium md:col-auto">{v.color}</span>
                      <span className="flex h-10 items-center">{v.size}</span>
                    </>
                  ) : (
                    <>
                      {cell("color", "Màu", { maxLength: 40 })}
                      {cell("size", "Size", { maxLength: 20 })}
                    </>
                  )}
                  {cell("price", "Giá bán (₫)", { inputMode: "numeric" })}
                  {cell("originalPrice", "Giá gốc (₫)", { inputMode: "numeric", placeholder: "—" })}
                  {cell("stock", "Tồn kho", { inputMode: "numeric", maxLength: 5 })}
                  {cell("sku", "SKU", { maxLength: 50 })}
                  <div className="col-span-2 flex justify-end md:col-span-1">
                    {v.removed ? (
                      <button type="button" onClick={() => setVariant(i, { removed: false })} className="h-10 px-2 text-label uppercase text-text-secondary hover:text-text-primary">Hoàn tác</button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Xóa ${v.color || "biến thể"} / ${v.size}`}
                        onClick={() => (v.id ? setVariant(i, { removed: true }) : set("variants", form.variants.filter((_, j) => j !== i)))}
                        className="flex size-10 items-center justify-center rounded-sm text-text-secondary hover:text-accent"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* §5: sticky footer bar on long forms, Cancel (ghost) + Save (primary) right-aligned. */}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-border bg-surface px-6 py-3">
        <Link href="/products" className="flex h-10 items-center px-4 text-button uppercase text-text-secondary hover:text-text-primary">Hủy</Link>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : creating ? "Tạo sản phẩm" : "Lưu"}
        </button>
      </div>
    </form>
  );
}

function Field({ id, label: text, hint, error, wide, children }: { id: string; label: string; hint?: string; error?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${wide ? "md:col-span-2" : ""}`}>
      <label htmlFor={id} className={label}>{text}</label>
      {children}
      {hint && <p className="text-stat-label text-text-secondary">{hint}</p>}
      {error}
    </div>
  );
}

function focusFirstError(errors: FieldErrors) {
  const first = Object.keys(errors).find((k) => document.getElementById(k));
  (first ? document.getElementById(first) : document.querySelector<HTMLElement>("[role=alert]"))?.focus();
}
