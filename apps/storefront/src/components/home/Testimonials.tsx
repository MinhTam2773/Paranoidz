import { TESTIMONIALS } from "@/data/testimonials";

// Customer testimonials (2026-10-16): real 5-star reviews from the Shopee shop
// (paranoidz.studio), lightly masked. Hydra-style: cards with stars, quote,
// masked name + product.
export function Testimonials() {
  return (
    <section aria-label="Cảm nhận từ khách hàng">
      <div className="mb-8 border-b border-border pb-4">
        <h2 className="text-h2 uppercase">Khách hàng nói gì</h2>
        <p className="mt-2 flex items-center gap-2 text-nav text-text-secondary">
          <span aria-hidden className="text-warning">★★★★★</span>
          5.0/5 từ đánh giá thật trên Shopee
          <a
            href="https://shopee.vn/paranoidz.studio"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-text-primary"
          >
            paranoidz.studio
          </a>
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {TESTIMONIALS.map((t) => (
          <li key={`${t.name}-${t.date}`} className="flex flex-col gap-3 bg-bg-primary p-6">
            <p aria-label="5 trên 5 sao" className="text-warning tracking-[0.15em]">★★★★★</p>
            {t.image && (
              <img src={t.image} alt={`Ảnh đánh giá của ${t.name}`} className="aspect-square w-full rounded-sm object-cover" loading="lazy" />
            )}
            <blockquote className="flex-1 text-body leading-relaxed text-text-primary">
              “{t.content}”
            </blockquote>
            <footer className="border-t border-border pt-3">
              <p className="text-nav font-semibold">{t.name}</p>
              <p className="mt-0.5 text-caption text-text-secondary">
                {t.product} · {t.date}
              </p>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
