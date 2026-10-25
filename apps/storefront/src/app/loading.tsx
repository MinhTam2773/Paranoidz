import { AsciiSkeleton } from "ascii-reveal";

// Route loading state (ascii loading): while a segment fetches, show an
// ASCII skeleton in the shape of a product page — gallery block on the left,
// title / price / action lines on the right. Plain HTML + CSS, so it paints on
// the first frame; when the real page mounts, AsciiPageReveal decodes it in.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6" aria-busy="true" aria-label="Đang tải">
      <div className="py-4">
        <AsciiSkeleton variant="scan" lines={1} widths={["38%"]} />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <AsciiSkeleton variant="scan" rows={12} width="100%" height={520} />
        <div className="flex flex-col gap-5">
          <AsciiSkeleton variant="scan" lines={2} widths={["92%", "64%"]} />
          <AsciiSkeleton variant="scan" lines={1} widths={["32%"]} />
          <AsciiSkeleton variant="scan" lines={3} widths={["100%", "100%", "72%"]} />
          <AsciiSkeleton variant="scan" rows={2} width="100%" height={48} />
        </div>
      </div>
    </div>
  );
}
