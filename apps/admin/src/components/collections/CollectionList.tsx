"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { reorderCollections, setCollectionActive } from "@/app/(shell)/collections/actions";
import { ActiveToggle } from "../ActiveToggle";
import { Toast, type ToastMessage } from "../Toast";

type Row = { id: string; name: string; slug: string; isActive: boolean; count: number };

const iconButton =
  "relative z-10 flex size-11 items-center justify-center rounded-sm text-text-secondary hover:text-text-primary disabled:opacity-30 md:size-10";

// Reorderable collection rows: native drag + ↑ ↓ buttons (mobile, keyboard),
// shown at once via useOptimistic while reorderCollections saves.
export function CollectionList({ collections }: { collections: Row[] }) {
  const [rows, setRows] = useOptimistic(collections);
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  function move(id: string, to: number) {
    const from = rows.findIndex((r) => r.id === id);
    if (from === to || to < 0 || to >= rows.length) return;
    const next = [...rows];
    next.splice(to, 0, ...next.splice(from, 1));
    startTransition(async () => {
      setRows(next);
      const { error } = await reorderCollections(next.map((r) => r.id));
      if (error) setToast({ ok: false, text: error });
    });
  }

  return (
    <>
      <ol className="overflow-hidden rounded-sm border border-border bg-surface">
        {rows.map((c, i) => (
          <li
            key={c.id}
            draggable={!pending}
            onDragStart={() => setDragId(c.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => { if (dragId) e.preventDefault(); }}
            onDrop={(e) => { if (!dragId) return; e.preventDefault(); move(dragId, i); setDragId(null); }}
            className={`relative flex min-h-14 items-center gap-3 border-t border-border px-4 py-2 first:border-t-0 hover:bg-bg-secondary ${dragId === c.id ? "opacity-40" : ""} ${pending ? "" : "cursor-grab"}`}
          >
            <span className="w-5 shrink-0 text-stat-label text-text-muted">{i + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <Link href={`/collections/${c.id}`} className="font-semibold wrap-break-word after:absolute after:inset-0">{c.name}</Link>
              <span className="text-stat-label text-text-secondary">/collections/{c.slug} · {c.count} sản phẩm</span>
            </span>
            <ActiveToggle name={c.name} active={c.isActive} label="Đang hiển thị" setActive={setCollectionActive.bind(null, c.id)} />
            <button type="button" onClick={() => move(c.id, i - 1)} disabled={pending || i === 0} aria-label={`Đưa ${c.name} lên`} className={iconButton}>↑</button>
            <button type="button" onClick={() => move(c.id, i + 1)} disabled={pending || i === rows.length - 1} aria-label={`Đưa ${c.name} xuống`} className={iconButton}>↓</button>
          </li>
        ))}
      </ol>
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
