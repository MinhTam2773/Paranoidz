"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import { addCategory, deleteCategory, renameCategory, reorderCategories } from "@/app/(shell)/products/categories/actions";
import { Toast, type ToastMessage } from "../Toast";

type Row = { id: string; name: string; count: number };

const input =
  "h-10 min-w-0 rounded-sm border border-border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";
const iconButton = "flex size-11 items-center justify-center rounded-sm text-text-secondary hover:text-text-primary disabled:opacity-30 md:size-10";
const textButton = "h-10 rounded-sm px-3 text-button uppercase text-text-secondary hover:text-text-primary disabled:opacity-30";

// DASHBOARD_DESIGN.md §6.3 categories: add, inline rename, drag / ↑ ↓ reorder
// (useOptimistic, like CollectionList), delete behind a modal when unused. The modal
// closes on success and on error, so an error toast isn't hidden behind it.
export function CategoryManager({ categories }: { categories: Row[] }) {
  const [rows, setRows] = useOptimistic(categories);
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (deleting) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [deleting]);

  function run(action: () => Promise<{ error?: string }>, ok: string, after: (saved: boolean) => void) {
    startTransition(async () => {
      const { error } = await action();
      startTransition(() => {
        setToast(error ? { ok: false, text: error } : { ok: true, text: ok });
        after(!error);
      });
    });
  }

  function add(e: FormEvent) {
    e.preventDefault();
    run(() => addCategory(newName), "Đã thêm danh mục", (saved) => saved && setNewName(""));
  }

  function move(id: string, to: number) {
    const from = rows.findIndex((r) => r.id === id);
    if (from === to || to < 0 || to >= rows.length) return;
    const next = [...rows];
    next.splice(to, 0, ...next.splice(from, 1));
    startTransition(async () => {
      setRows(next);
      const { error } = await reorderCategories(next.map((r) => r.id));
      if (error) setToast({ ok: false, text: error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} noValidate className="flex gap-2">
        <input
          value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50}
          aria-label="Tên danh mục mới" placeholder="Tên danh mục mới, ví dụ: Áo thun"
          className={`${input} flex-1 placeholder:text-text-muted md:max-w-80`}
        />
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark enabled:hover:bg-accent-hover disabled:opacity-50">
          Thêm
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">Chưa có danh mục nào.</p>
      ) : (
        <ol className="overflow-hidden rounded-sm border border-border bg-surface">
          {rows.map((c, i) => (
            <li
              key={c.id}
              draggable={!pending && !editing}
              onDragStart={() => setDragId(c.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
              onDrop={(e) => { if (!dragId) return; e.preventDefault(); move(dragId, i); setDragId(null); }}
              className={`flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 first:border-t-0 ${dragId === c.id ? "opacity-40" : ""} ${pending || editing ? "" : "cursor-grab"}`}
            >
              <span className="w-5 shrink-0 text-stat-label text-text-muted">{i + 1}</span>
              {editing?.id === c.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); run(() => renameCategory(c.id, editing.name), "Đã đổi tên danh mục", (saved) => saved && setEditing(null)); }}
                  noValidate className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                >
                  <input
                    value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} maxLength={50} autoFocus
                    aria-label={`Tên mới cho ${c.name}`} className={`${input} flex-1`}
                  />
                  <button type="submit" disabled={pending} className="h-10 rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark enabled:hover:bg-accent-hover disabled:opacity-50">Lưu</button>
                  <button type="button" onClick={() => setEditing(null)} disabled={pending} className={textButton}>Hủy</button>
                </form>
              ) : (
                <>
                  <span className="flex min-w-48 flex-1 flex-col">
                    <span className="font-semibold wrap-break-word">{c.name}</span>
                    <span className="text-stat-label text-text-secondary">{c.count} sản phẩm</span>
                  </span>
                  <span className="ml-auto flex items-center">
                    <button type="button" onClick={() => move(c.id, i - 1)} disabled={pending || i === 0} aria-label={`Đưa ${c.name} lên`} className={iconButton}>↑</button>
                    <button type="button" onClick={() => move(c.id, i + 1)} disabled={pending || i === rows.length - 1} aria-label={`Đưa ${c.name} xuống`} className={iconButton}>↓</button>
                    <button type="button" onClick={() => setEditing({ id: c.id, name: c.name })} disabled={pending} aria-label={`Sửa ${c.name}`} className={textButton}>Sửa</button>
                    <button
                      type="button" onClick={() => setDeleting(c)} disabled={pending || c.count > 0}
                      aria-label={`Xóa ${c.name}`} title={c.count > 0 ? "Chỉ xóa được danh mục chưa có sản phẩm" : undefined}
                      className={`${textButton} hover:text-accent`}
                    >
                      Xóa
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-category-title"
        onCancel={(e) => (pending ? e.preventDefault() : setDeleting(null))}
        className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-sm bg-surface p-6 text-text-primary shadow-2 backdrop:bg-bg-dark/50"
      >
        {deleting && (
          <div className="flex flex-col gap-4">
            <h2 id="delete-category-title" className="text-card-title uppercase">Xóa danh mục {deleting.name}?</h2>
            <p className="text-text-secondary">Danh mục chưa có sản phẩm nào. Hàng của danh mục này trên trang chủ cửa hàng cũng biến mất.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleting(null)} disabled={pending} className="h-10 rounded-sm px-4 text-button uppercase text-text-secondary hover:text-text-primary disabled:opacity-50">
                Quay lại
              </button>
              <button
                type="button" disabled={pending}
                onClick={() => run(() => deleteCategory(deleting.id), "Đã xóa danh mục", () => setDeleting(null))}
                className="h-10 rounded-sm border border-accent px-4 text-button uppercase text-accent transition-colors duration-200 enabled:hover:bg-accent enabled:hover:text-text-on-dark disabled:opacity-50"
              >
                {pending ? "Đang xóa…" : "Xóa danh mục"}
              </button>
            </div>
          </div>
        )}
      </dialog>
      <Toast toast={toast} setToast={setToast} />
    </div>
  );
}
