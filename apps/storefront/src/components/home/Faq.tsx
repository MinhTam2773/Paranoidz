"use client";

import { useState } from "react";
import { FAQS } from "./faq-data";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section aria-label="Câu hỏi thường gặp">
      <h2 className="text-center text-h2 uppercase lg:text-h1">
        Bạn có câu hỏi gì
        <br />
        hãy để chúng tôi giải đáp
      </h2>
      <div className="mx-auto mt-8 max-w-3xl">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="border-b border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-nav font-bold">{f.q}</span>
                <span
                  aria-hidden
                  className={`shrink-0 text-text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                  ⌄
                </span>
              </button>
              <div
                className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <p className="overflow-hidden text-body text-text-secondary">{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
