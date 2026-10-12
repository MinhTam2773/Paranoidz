"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveCollection } from "@/app/(shell)/collections/actions";
import type { PickerProduct } from "@/lib/picker-products";
import { slugify } from "@/lib/product";
import { Toast, type ToastMessage } from "../Toast";

const input =
  "h-10 w-full rounded-sm border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none disabled:bg-bg-secondary disabled:text-text-secondary";
const card = "flex flex-col gap-5 rounded-sm border border-border bg-surface p-5";
const iconButton = "flex size-11 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:text-text-primary disabled:opacity-30 md:size-10";

// Full-page create / edit (§6.6, no modal CRUD). Saved in one go: name, active,
// and the ordered product list (collection_items.sort_order = position).
export function CollectionForm({ initial, products }: {
  initial: { id?: string; name: string; slug: string; description: string; isActive: boolean; productIds: string[] };
  products: PickerProduct[];
}) {
  const router = useRouter();
  const creating = !initial.id;
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState(initial.description);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [selected, setSelected] = useState(initial.productIds);
  const [filter, setFilter] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [p.id, p]));
  const chosen = selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const q = filter.trim().toLowerCase();
  const available = products.filter((p) => !selected.includes(p.id) && (!q || p.name.toLowerCase().includes(q)));

  function move(id: string, to: number) {
    const from = selected.indexOf(id);
    if (from === to || to < 0 || to >= selected.length) return;
    const next = [...selected];
    next.splice(to, 0, ...next.splice(from, 1));
    setSelected(next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveCollection({ id: initial.id, name, slug, description, isActive, productIds: selected });
      startTransition(() => {
        setErrors(res.errors ?? {});
        if (res.errors) return;
        if (creating) router.push(`/collections/${res.id}`);
        else setToast({ ok: true, text: "Đã lưu bộ sưu tập" });
      });
    });
  }

  const thumb = (p: PickerProduct) => (
    <span className="relative block aspect-3/4 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
      {p.thumbUrl && <Image src={p.thumbUrl} alt="" fill sizes="40px" className="object-cover" />}
    </span>
  );
  const err = (k: string) => errors[k] && <p id={`${k}-error`} className="text-stat-label text-accent">{errors[k]}</p>;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {errors.form && <p role="alert" className="rounded-sm border border-accent bg-surface p-4 text-accent">{errors.form}</p>}

      <section className={card}>
        <h2 className="text-card-title uppercase">Thông tin</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-label uppercase">Tên bộ sưu tập</label>
            <input
              id="name" value={name} maxLength={80} aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                if (creating && !slugEdited) setSlug(slugify(e.target.value));
                setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "name" && k !== "slug")));
              }}
              className={`${input} ${errors.name ? "border-accent" : "border-border"}`}
            />
            {err("name")}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="slug" className="text-label uppercase">Đường dẫn (slug)</label>
            <input
              id="slug" value={slug} maxLength={80} disabled={!creating} aria-invalid={!!errors.slug} aria-describedby={errors.slug ? "slug-error" : undefined}
              onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }}
              className={`${input} ${errors.slug ? "border-accent" : "border-border"}`}
            />
            <p className="text-stat-label text-text-secondary">
              Trang trên cửa hàng: /collections/{slug || "…"} — không đổi được sau khi tạo. Menu cửa hàng dùng &quot;outlet-2026&quot; và &quot;new-collection&quot;.
            </p>
            {err("slug")}
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="description" className="text-label uppercase">Mô tả</label>
            <textarea
              id="description" value={description} rows={2} maxLength={300} aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined}
              onChange={(e) => setDescription(e.target.value)}
              className={`${input} h-auto py-2 ${errors.description ? "border-accent" : "border-border"}`}
            />
            <p className="text-stat-label text-text-secondary">Hiện dưới tên bộ sưu tập trên cửa hàng. Để trống nếu không cần.</p>
            {err("description")}
          </div>
          <label className="flex h-10 items-center gap-3">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 accent-text-primary" />
            Hiển thị trên cửa hàng
          </label>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-card-title uppercase">Sản phẩm ({chosen.length})</h2>
        {err("products")}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-label uppercase">Trong bộ sưu tập — kéo hoặc dùng ↑ ↓ để sắp xếp</h3>
            {chosen.length === 0 ? (
              <p className="rounded-sm bg-bg-secondary p-4 text-text-secondary">Chưa có sản phẩm. Thêm từ danh sách bên cạnh.</p>
            ) : (
              <ol className="flex flex-col">
                {chosen.map((p, i) => (
                  <li
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                    onDrop={(e) => { if (!dragId) return; e.preventDefault(); move(dragId, i); setDragId(null); }}
                    className={`flex cursor-grab items-center gap-3 border-b border-border py-2 ${dragId === p.id ? "opacity-40" : ""}`}
                  >
                    <span className="w-5 shrink-0 text-stat-label text-text-muted">{i + 1}</span>
                    {thumb(p)}
                    <span className="min-w-0 flex-1 wrap-break-word">
                      {p.name}
                      {!p.isActive && <span className="block text-stat-label text-text-secondary">Đang ẩn — không hiện trên cửa hàng</span>}
                    </span>
                    <button type="button" onClick={() => move(p.id, i - 1)} disabled={i === 0} aria-label={`Đưa ${p.name} lên`} className={iconButton}>↑</button>
                    <button type="button" onClick={() => move(p.id, i + 1)} disabled={i === chosen.length - 1} aria-label={`Đưa ${p.name} xuống`} className={iconButton}>↓</button>
                    <button type="button" onClick={() => setSelected(selected.filter((id) => id !== p.id))} aria-label={`Bỏ ${p.name} khỏi bộ sưu tập`} className={`${iconButton} hover:text-accent`}>×</button>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="product-filter" className="text-label uppercase">Thêm sản phẩm</label>
            <input
              id="product-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc theo tên"
              className={`${input} border-border placeholder:text-text-muted`}
            />
            <ul className="flex max-h-96 flex-col overflow-y-auto">
              {available.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-border py-2">
                  {thumb(p)}
                  <span className="min-w-0 flex-1 wrap-break-word">
                    {p.name}
                    {!p.isActive && <span className="block text-stat-label text-text-secondary">Đang ẩn</span>}
                  </span>
                  <button
                    type="button" onClick={() => setSelected([...selected, p.id])}
                    className="h-10 shrink-0 rounded-sm border border-text-primary px-3 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark"
                  >
                    Thêm
                  </button>
                </li>
              ))}
              {available.length === 0 && <li className="py-3 text-text-secondary">{q ? "Không có sản phẩm khớp." : "Đã thêm tất cả sản phẩm."}</li>}
            </ul>
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-border bg-surface px-6 py-3">
        <Link href="/collections" className="flex h-10 items-center px-4 text-button uppercase text-text-secondary hover:text-text-primary">Hủy</Link>
        <button
          type="submit" disabled={pending}
          className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : creating ? "Tạo bộ sưu tập" : "Lưu"}
        </button>
      </div>
      <Toast toast={toast} setToast={setToast} />
    </form>
  );
}
