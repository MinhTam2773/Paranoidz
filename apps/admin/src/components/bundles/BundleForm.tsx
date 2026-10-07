"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveBundle, type BundleInput } from "@/app/(shell)/bundles/actions";
import { formatVnd } from "@/lib/format";
import type { PickerProduct } from "@/lib/picker-products";
import { Toast, type ToastMessage } from "../Toast";

const input =
  "h-10 w-full rounded-sm border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";
const card = "flex flex-col gap-5 rounded-sm border border-border bg-surface p-5";

// Full-page create / edit (§6.5, no modal CRUD): name, discount, active, products, and a
// live preview of the combined price vs the bundle price (cheapest variant of each product).
export function BundleForm({ initial, products }: { initial: BundleInput; products: PickerProduct[] }) {
  const router = useRouter();
  const creating = !initial.id;
  const [name, setName] = useState(initial.name);
  const [discountAmount, setDiscountAmount] = useState(initial.discountAmount);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [selected, setSelected] = useState(initial.productIds);
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [p.id, p]));
  const chosen = selected.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const q = filter.trim().toLowerCase();
  const available = products.filter((p) => !selected.includes(p.id) && (!q || p.name.toLowerCase().includes(q)));
  const combined = chosen.reduce((sum, p) => sum + (p.minPrice ?? 0), 0);
  const discount = /^\d+$/.test(discountAmount.trim()) ? Number(discountAmount.trim()) : 0;

  function clear(...keys: string[]) {
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveBundle({ id: initial.id, name, discountAmount, isActive, productIds: selected });
      startTransition(() => {
        setErrors(res.errors ?? {});
        if (res.errors) return;
        if (creating) router.push(`/bundles/${res.id}`);
        else setToast({ ok: true, text: "Đã lưu combo" });
      });
    });
  }

  const thumb = (p: PickerProduct) => (
    <span className="relative block aspect-3/4 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
      {p.thumbUrl && <Image src={p.thumbUrl} alt="" fill sizes="40px" className="object-cover" />}
    </span>
  );
  const label = (p: PickerProduct) => (
    <span className="min-w-0 flex-1 wrap-break-word">
      {p.name}
      <span className="block text-stat-label text-text-secondary">
        {p.minPrice === null ? "Chưa có giá" : `Từ ${formatVnd(p.minPrice)}`}
        {!p.isActive && " · Đang ẩn — combo chưa áp dụng được"}
      </span>
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
            <label htmlFor="name" className="text-label uppercase">Tên combo</label>
            <input
              id="name" value={name} maxLength={80} aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined}
              onChange={(e) => { setName(e.target.value); clear("name"); }}
              className={`${input} ${errors.name ? "border-accent" : "border-border"}`}
            />
            {err("name")}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="discountAmount" className="text-label uppercase">Giảm mỗi combo (₫)</label>
            <input
              id="discountAmount" value={discountAmount} inputMode="numeric" maxLength={9}
              aria-invalid={!!errors.discountAmount} aria-describedby={`discountAmount-hint${errors.discountAmount ? " discountAmount-error" : ""}`}
              onChange={(e) => { setDiscountAmount(e.target.value.replace(/\D/g, "")); clear("discountAmount"); }}
              className={`${input} ${errors.discountAmount ? "border-accent" : "border-border"}`}
            />
            <p id="discountAmount-hint" className="text-stat-label text-text-secondary">
              Trừ một lần cho mỗi bộ đủ sản phẩm trong đơn. Không cộng dồn với mã giảm giá — khách được mức giảm cao hơn.
            </p>
            {err("discountAmount")}
          </div>
          <label className="flex h-10 items-center gap-3">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 accent-text-primary" />
            Đang áp dụng
          </label>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-card-title uppercase">Sản phẩm ({chosen.length})</h2>
        {err("products")}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-label uppercase">Trong combo — mỗi sản phẩm 1 cái, phân loại nào cũng được</h3>
              {chosen.length === 0 ? (
                <p className="rounded-sm bg-bg-secondary p-4 text-text-secondary">Chưa có sản phẩm. Thêm từ 2 đến 10 sản phẩm.</p>
              ) : (
                <ul className="flex flex-col">
                  {chosen.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 border-b border-border py-2">
                      {thumb(p)}
                      {label(p)}
                      <button
                        type="button" onClick={() => { setSelected(selected.filter((id) => id !== p.id)); clear("products", "discountAmount"); }}
                        aria-label={`Bỏ ${p.name} khỏi combo`}
                        className="flex size-11 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:text-accent md:size-10"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <dl aria-live="polite" className="flex flex-col gap-2 rounded-sm bg-bg-secondary p-4">
              <div className="flex justify-between gap-4"><dt className="text-text-secondary">Tổng giá lẻ (thấp nhất)</dt><dd>{formatVnd(combined)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-text-secondary">Giảm</dt><dd>−{formatVnd(discount)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                <dt>Giá combo</dt>
                <dd className={discount >= combined && chosen.length ? "text-accent" : ""}>{formatVnd(Math.max(combined - discount, 0))}</dd>
              </div>
              {chosen.length > 0 && discount >= combined && <p className="text-stat-label text-accent">Mức giảm phải nhỏ hơn tổng giá lẻ.</p>}
              {chosen.length > 0 && discount > 0 && discount < combined && (
                <p className="text-stat-label text-text-secondary">Khách tiết kiệm {Math.round((discount / combined) * 100)}% khi mua đủ bộ (giá theo phân loại rẻ nhất).</p>
              )}
            </dl>
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
                  {label(p)}
                  <button
                    type="button" disabled={p.minPrice === null || selected.length >= 10} aria-label={`Thêm ${p.name}`}
                    onClick={() => { setSelected([...selected, p.id]); clear("products", "discountAmount"); }}
                    className="h-10 shrink-0 rounded-sm border border-text-primary px-3 text-button uppercase transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:opacity-30"
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
        <Link href="/bundles" className="flex h-10 items-center px-4 text-button uppercase text-text-secondary hover:text-text-primary">Hủy</Link>
        <button
          type="submit" disabled={pending}
          className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : creating ? "Tạo combo" : "Lưu"}
        </button>
      </div>
      <Toast toast={toast} setToast={setToast} />
    </form>
  );
}
