// products.size_guide shape (ARCHITECTURE.md §7). Admin-entered jsonb, so check it at runtime.
export type SizeGuideData = { sizes: string[]; rows: { label: string; values: string[] }[] };

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

export function isSizeGuide(v: unknown): v is SizeGuideData {
  if (typeof v !== "object" || v === null) return false;
  const { sizes, rows } = v as Record<string, unknown>;
  return (
    isStrings(sizes) &&
    sizes.length > 0 &&
    Array.isArray(rows) &&
    rows.every(
      (r) => typeof r?.label === "string" && isStrings(r?.values) && r.values.length === sizes.length,
    )
  );
}

export function SizeGuide({ guide }: { guide: SizeGuideData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center">
        <thead>
          <tr className="bg-bg-secondary text-nav uppercase text-text-primary">
            <th scope="col" className="px-4 py-3 text-left">Size</th>
            {guide.sizes.map((size) => (
              <th key={size} scope="col" className="px-4 py-3">
                {size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guide.rows.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <th scope="row" className="px-4 py-3 text-left font-normal whitespace-nowrap text-text-secondary">
                {row.label}
              </th>
              {row.values.map((value, i) => (
                <td key={i} className="px-4 py-3 whitespace-nowrap">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
