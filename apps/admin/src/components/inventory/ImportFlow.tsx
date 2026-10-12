"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  applyImport, previewImport, type ApplyResult, type GroupChoice, type ImportPreview,
} from "@/app/(shell)/inventory/import/actions";
import { DEFAULT_PERCENT } from "@/lib/bigseller/listings-file";
import { formatDateTime, formatVnd } from "@/lib/format";
import { signed } from "@/lib/inventory";

const card = "flex flex-col gap-4 rounded-sm border border-border bg-surface p-5";
const cardTitle = "text-card-title uppercase";
const input =
  "h-10 w-full rounded-sm border border-border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none disabled:bg-bg-secondary";
const primary =
  "h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:opacity-50";
const th = "px-3 py-2 text-left text-th uppercase text-text-secondary";
const td = "border-t border-border px-3 py-2";

type Choice = GroupChoice & { include: boolean };

// Upload → preview → apply. Both server actions re-read the files, so the files stay
// in this component's state until the import is applied.
export function ImportFlow() {
  const [inventory, setInventory] = useState<File | null>(null);
  const [listings, setListings] = useState<File | null>(null);
  const [percent, setPercent] = useState(String(DEFAULT_PERCENT));
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [confirmFresh, setConfirmFresh] = useState(false);
  const [photos, setPhotos] = useState(true);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [pending, startTransition] = useTransition();

  const files = () => {
    const fd = new FormData();
    if (inventory) fd.append("inventory", inventory);
    if (listings) fd.append("listings", listings);
    fd.append("percent", percent);
    return fd;
  };

  function runPreview() {
    setResult(null);
    startTransition(async () => {
      const p = await previewImport(files());
      setPreview(p);
      setConfirmFresh(false);
      setChoices(Object.fromEntries(p.newGroups.map((g) => [g.code, {
        code: g.code,
        include: true,
        name: g.title.slice(0, 120),
        colors: Object.fromEntries(g.colors.map((c) => [c.color, c.label])),
        prices: Object.fromEntries(g.variants.map((v) => [v.sku, {
          price: v.price ? String(v.price) : "",
          original: v.shopeePrice && v.price && v.shopeePrice > v.price ? String(v.shopeePrice) : "",
        }])),
      }])));
    });
  }

  function apply() {
    const fd = files();
    fd.append("choices", JSON.stringify({
      percent: Number(percent), confirmFresh, photos,
      groups: Object.values(choices).filter((c) => c.include).map(({ code, name, colors, prices }) => ({ code, name, colors, prices })),
    }));
    startTransition(async () => {
      const r = await applyImport(fd);
      setResult(r);
      if (!r.errors.length) setPreview(null);
    });
  }

  const resetFiles = (set: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.files?.[0] ?? null);
    setPreview(null);
    setResult(null);
  };
  const setGroup = (code: string, patch: Partial<Choice>) => setChoices((c) => ({ ...c, [code]: { ...c[code], ...patch } }));
  const blocked = !!preview?.errors.length || (preview?.freshness.needsConfirm && !confirmFresh);
  const nothing = preview && !preview.updates.length && !Object.values(choices).some((c) => c.include);

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h2 className={cardTitle}>1. Chọn file từ BigSeller</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="inventory" className="text-label uppercase">File tồn kho (bắt buộc)</label>
            <input id="inventory" type="file" accept=".xlsx" onChange={resetFiles(setInventory)} className="text-base md:text-input" />
            <p className="text-stat-label text-text-secondary">BigSeller → Inventory → Inventory List → Import &amp; Export → Export All. Xuất ngay trước khi nhập.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="listings" className="text-label uppercase">File sản phẩm Shopee (để gợi ý giá)</label>
            <input id="listings" type="file" accept=".xlsx" onChange={resetFiles(setListings)} className="text-base md:text-input" />
            <p className="text-stat-label text-text-secondary">BigSeller → Products → Shopee → Active → Import &amp; Export → Export by Page. Chỉ dùng cho sản phẩm mới.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="percent" className="text-label uppercase">Giá web = % giá Shopee (pdz01-SP)</label>
            <input id="percent" inputMode="numeric" value={percent} maxLength={3} onChange={(e) => { setPercent(e.target.value.replace(/\D/g, "")); setPreview(null); }} className={`${input} md:w-32`} />
            <p className="text-stat-label text-text-secondary">Giá khuyến mãi trên Shopee × %, làm tròn xuống ₫1.000. Sửa được từng giá ở bước sau.</p>
          </div>
        </div>
        <div>
          <button type="button" onClick={runPreview} disabled={!inventory || pending || !(Number(percent) > 0 && Number(percent) <= 100)} className={secondary}>
            {pending && !preview ? "Đang đọc…" : "Xem trước"}
          </button>
        </div>
      </section>

      {result && <Result result={result} />}

      {preview && (
        <>
          {preview.errors.length > 0 && <Notice tone="error" items={preview.errors} />}
          {preview.warnings.length > 0 && <Notice tone="info" items={preview.warnings} />}
          {preview.freshness.needsConfirm && !preview.errors.length && (
            <label className="flex items-start gap-3 rounded-sm border border-warning bg-surface p-4">
              <input type="checkbox" checked={confirmFresh} onChange={(e) => setConfirmFresh(e.target.checked)} className="mt-1 size-5 accent-text-primary" />
              <span>Không đọc được thời điểm xuất từ tên file. Tôi xác nhận file này được xuất từ BigSeller <strong>sau</strong> lần gửi gần nhất ({preview.freshness.lastSent ? formatDateTime(preview.freshness.lastSent) : "—"}).</span>
            </label>
          )}

          {!preview.errors.length && (
            <>
              <section className={card}>
                <h2 className={cardTitle}>2. Cập nhật tồn kho ({preview.updates.length})</h2>
                <p className="text-text-secondary">
                  {preview.updates.length ? "Tồn kho web = có sẵn trên BigSeller − đơn web chưa gửi + thay đổi chưa gửi." : "Tồn kho web đã khớp với BigSeller."}
                  {preview.unchanged > 0 && ` ${preview.unchanged} SKU không đổi.`}
                  {preview.freshness.fileTime && ` File xuất lúc ${formatDateTime(preview.freshness.fileTime)}.`}
                </p>
                {preview.updates.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                      <thead><tr><th className={th}>SKU</th><th className={`${th} text-right`}>Web hiện tại</th><th className={`${th} text-right`}>BigSeller có sẵn</th><th className={`${th} text-right`}>Chưa gửi</th><th className={`${th} text-right`}>Web mới</th></tr></thead>
                      <tbody>
                        {preview.updates.map((u) => (
                          <tr key={u.variantId}>
                            <td className={td}>{u.sku}</td>
                            <td className={`${td} text-right`}>{u.current}</td>
                            <td className={`${td} text-right`}>{u.available}</td>
                            <td className={`${td} text-right`}>{u.unsent.adj + u.unsent.back - u.unsent.out ? signed(u.unsent.adj + u.unsent.back - u.unsent.out) : "—"}</td>
                            <td className={`${td} text-right font-semibold`}>{u.target}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className={card}>
                <h2 className={cardTitle}>3. Sản phẩm mới ({preview.newGroups.length})</h2>
                {preview.newGroups.length === 0 ? (
                  <p className="text-text-secondary">Không có SKU mới.</p>
                ) : (
                  <>
                    <p className="text-text-secondary">Tạo ở trạng thái <strong>ẩn</strong>. Sau khi tạo, thêm mô tả, danh mục, bảng size rồi bật &quot;Đang bán&quot; trong trang sản phẩm.</p>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="size-5 accent-text-primary" />
                      Tải ảnh từ BigSeller (mỗi màu một ảnh, bản gốc 1024px)
                    </label>
                    {preview.newGroups.map((g) => (
                      <NewGroup key={g.code} group={g} choice={choices[g.code]} setGroup={(p) => setGroup(g.code, p)} />
                    ))}
                  </>
                )}
              </section>

              {(preview.knownCodeSkus.length > 0 || preview.unparsable.length > 0 || preview.missingFromFile.length > 0) && (
                <section className={card}>
                  <h2 className={cardTitle}>Chỉ để xem</h2>
                  {preview.knownCodeSkus.length > 0 && <p><strong>SKU mới của sản phẩm đã có</strong> (thêm biến thể trong trang sản phẩm, đúng SKU): {preview.knownCodeSkus.join(", ")}</p>}
                  {preview.unparsable.length > 0 && <p><strong>SKU không đọc được màu/size</strong> (cần dạng mã-Màu-Size): {preview.unparsable.join(", ")}</p>}
                  {preview.missingFromFile.length > 0 && <p><strong>SKU trên web không có trong file</strong> (giữ nguyên): {preview.missingFromFile.join(", ")}</p>}
                </section>
              )}

              <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-3 border-t border-border bg-surface px-6 py-3">
                {nothing && <span className="text-text-secondary">Không có gì để áp dụng.</span>}
                <button type="button" onClick={apply} disabled={pending || !!blocked || !!nothing} className={primary}>
                  {pending ? "Đang áp dụng…" : "Áp dụng"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function NewGroup({ group, choice, setGroup }: {
  group: ImportPreview["newGroups"][number];
  choice: Choice | undefined;
  setGroup: (patch: Partial<Choice>) => void;
}) {
  if (!choice) return null;
  const setPrice = (sku: string, field: "price" | "original", value: string) =>
    setGroup({ prices: { ...choice.prices, [sku]: { ...choice.prices[sku], [field]: value } } });
  const off = !choice.include;
  return (
    <div className={`flex flex-col gap-3 rounded-sm border border-border p-4 ${off ? "opacity-60" : ""}`}>
      <label className="flex items-center gap-3 font-semibold">
        <input type="checkbox" checked={choice.include} onChange={(e) => setGroup({ include: e.target.checked })} className="size-5 accent-text-primary" />
        {group.code} · {group.variants.length} SKU{group.photos ? ` · ${group.photos} ảnh` : ""}
      </label>
      <div className="flex flex-col gap-2">
        <label htmlFor={`name-${group.code}`} className="text-label uppercase">Tên sản phẩm</label>
        <input id={`name-${group.code}`} value={choice.name} maxLength={120} disabled={off} onChange={(e) => setGroup({ name: e.target.value })} className={input} />
        <p className="text-stat-label text-text-secondary">Tiêu đề Shopee: {group.title}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {group.colors.map((c) => (
          <div key={c.color} className="flex flex-col gap-1">
            <label htmlFor={`color-${group.code}-${c.color}`} className="text-stat-label uppercase text-text-secondary">Màu {c.color}</label>
            <input
              id={`color-${group.code}-${c.color}`} value={choice.colors[c.color] ?? ""} maxLength={40} disabled={off}
              onChange={(e) => setGroup({ colors: { ...choice.colors, [c.color]: e.target.value } })} className={`${input} w-40`}
            />
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr><th className={th}>SKU</th><th className={th}>Size</th><th className={`${th} text-right`}>Tồn kho</th><th className={`${th} text-right`}>Giá Shopee</th><th className={th}>Giá bán (₫)</th><th className={th}>Giá gốc (₫)</th></tr></thead>
          <tbody>
            {group.variants.map((v) => (
              <tr key={v.sku}>
                <td className={td}>{v.sku}</td>
                <td className={td}>{v.size}</td>
                <td className={`${td} text-right`}>{v.available}</td>
                <td className={`${td} text-right text-text-secondary`}>{v.shopeePrice ? formatVnd(v.shopeePrice) : "—"}</td>
                <td className={td}>
                  <input aria-label={`Giá bán ${v.sku}`} inputMode="numeric" value={choice.prices[v.sku]?.price ?? ""} disabled={off} onChange={(e) => setPrice(v.sku, "price", e.target.value)} className={`${input} w-32`} />
                </td>
                <td className={td}>
                  <input aria-label={`Giá gốc ${v.sku}`} inputMode="numeric" value={choice.prices[v.sku]?.original ?? ""} placeholder="—" disabled={off} onChange={(e) => setPrice(v.sku, "original", e.target.value)} className={`${input} w-32 placeholder:text-text-muted`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Notice({ tone, items }: { tone: "error" | "info"; items: string[] }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex flex-col gap-1 rounded-sm border bg-surface p-4 ${tone === "error" ? "border-accent text-accent" : "border-border text-text-secondary"}`}>
      {items.map((t) => <p key={t}>{t}</p>)}
    </div>
  );
}

function Result({ result }: { result: ApplyResult }) {
  return (
    <section className={card}>
      <h2 className={cardTitle}>Kết quả</h2>
      {result.errors.length > 0 && <Notice tone="error" items={result.errors} />}
      {result.updated > 0 && <p>✓ Đã cập nhật tồn kho {result.updated} SKU.</p>}
      {result.created.map((c) => (
        <p key={c.id}>
          ✓ Đã tạo <Link href={`/products/${c.id}`} className="font-semibold underline">{c.name}</Link> (ẩn) — {c.variants} biến thể, {c.photos} ảnh
          {c.photoFailures > 0 && <span className="text-accent"> · {c.photoFailures} ảnh không tải được</span>}
        </p>
      ))}
      {!result.errors.length && !result.updated && !result.created.length && <p>Không có thay đổi.</p>}
      <div className="flex gap-2">
        <Link href="/inventory" className="flex h-10 items-center rounded-sm border border-text-primary px-4 text-button uppercase hover:bg-text-primary hover:text-text-on-dark">Xem tồn kho</Link>
      </div>
    </section>
  );
}
