// Instant feedback while a product page loads (client navigation included):
// without this, tapping a card looks dead for the whole server round-trip
// (measured ~1-2.3s on production), which reads as a broken click.
export default function ProductLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 pb-28 lg:px-6" aria-label="Đang tải sản phẩm">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square rounded-sm bg-bg-secondary" />
        <div className="flex flex-col gap-4">
          <div className="h-7 w-3/4 rounded-sm bg-bg-secondary" />
          <div className="h-6 w-1/3 rounded-sm bg-bg-secondary" />
          <div className="h-12 w-full rounded-sm bg-bg-secondary" />
          <div className="h-12 w-full rounded-sm bg-bg-secondary" />
        </div>
      </div>
    </div>
  );
}
