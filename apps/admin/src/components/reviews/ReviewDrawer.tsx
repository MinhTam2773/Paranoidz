"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon } from "../icons";

// Right-side detail drawer (DASHBOARD_DESIGN.md §6.9). Open = the list URL has ?review=<id>;
// closing (✕, Esc, backdrop) goes back to the list URL. A modal <dialog> traps focus.
export function ReviewDrawer({ closeHref, children }: { closeHref: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="review-drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="my-0 mr-0 ml-auto h-dvh max-h-none w-full max-w-[480px] bg-surface text-text-primary shadow-3 backdrop:bg-bg-dark/50"
    >
      <div className="flex h-16 items-center justify-between border-b border-border pr-2 pl-5">
        <h2 id="review-drawer-title" className="text-card-title uppercase">Chi tiết đánh giá</h2>
        <button type="button" onClick={close} aria-label="Đóng" className="flex size-12 items-center justify-center">
          <CloseIcon />
        </button>
      </div>
      <div className="flex flex-col gap-6 p-5">{children}</div>
    </dialog>
  );
}
