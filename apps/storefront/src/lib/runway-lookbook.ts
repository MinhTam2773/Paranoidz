import type { ProductCardData } from "@/components/product/ProductCard";

// Same order as the product page's size picker (ProductView, a client module this server code can't call).
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];
const sizeRank = (size: string) => {
  const i = SIZE_ORDER.indexOf(size);
  return i === -1 ? SIZE_ORDER.length : i;
};

// Runway lookbook on the homepage (2026-11-05, lookbook-handoff/HANDOFF.md): 8 cut-out models, each
// wearing one PDZ tee with a bag or backpack from the shop. Only the photos, titles and pairings live
// here; names, photos, prices and stock come from the live catalog, so an admin price change shows
// up on the next ISR rebuild. Photos: public/lookbook/m1…m8.webp (trimmed to the model, ≤ 1600 px
// tall). `k` scales one photo against the others; `full` = a full-body shot that stands on the
// floor with a shadow (the rest run off the bottom edge). Re-tune both when the owner swaps photos.
// `colors`: the colour(s) worn in the photo. Matching variants are preselected; if none match (e.g.
// balo 9932, whose colours are named 1–5) the customer picks.
type LookConfig = {
  image: string;
  width: number;
  height: number;
  title: string;
  items: { slug: string; colors: string[] }[];
  k?: number;
  full?: boolean;
};

const S = {
  pdz01: "ao-thun-localbrand-unisex-form-boxy-slim-fit-theu-minimalism-vai-nhung-pre-pdz01",
  pdz02: "ao-thun-local-brand-unisex-form-boxy-slim-fit-theu-vit-vang-vai-nhung-prem-pdz02",
  pdz03: "ao-thun-localbrand-dap-noi-3d-paranoidz-form-rong-unisex-nam-nu-vai-cotton-pdz03",
  pdz04: "ao-thun-localbrand-dap-noi-3d-made-in-pain-form-rong-unisex-nam-nu-vai-cot-pdz04",
  pdz05: "ao-polo-oversize-unisex-localbrand-paranoidz-theu-chu-nhat-vai-cotton-sign-pdz05",
  pdz06: "ao-polo-nam-vai-thun-gan-form-slimfit-om-sat-thoi-trang-thanh-lich-phong-d-pdz06",
  pdz07: "ao-thun-nam-oversize-localbrand-vai-cotton-hinh-theu-lon-form-rong-the-tha-pdz07",
  pdz08: "ao-thun-localbrand-unisex-form-boxy-slim-fit-theu-minimalism-vai-nhung-pre-pdz08",
  b662: "tui-deo-cheo-nam-form-ngang-phong-cach-nhat-662",
  b9932: "balo-9932",
  b1325: "tui-1325",
  k5350: "tui-tote-hinh-thu-kem-moc-khoa-k5350",
  fa518: "tui-du-lich-ke-soc-co-ngan-dung-giay-fa518-5",
  b0711: "tui-tote-in-hinh-khoa-keo-mieng-tui-0711",
  b9726: "balo-9726",
};

const LOOKS: LookConfig[] = [
  { image: "/lookbook/m1.webp", width: 1085, height: 1600, title: "Đôi minimalism: Cream và Basic Gray", k: 0.97,
    items: [{ slug: S.pdz01, colors: ["Cream", "Basic Gray"] }, { slug: S.b662, colors: ["Kaki"] }, { slug: S.k5350, colors: ["Be"] }] },
  { image: "/lookbook/m2.webp", width: 718, height: 1600, title: "Vịt vàng Basic Gray, tote đi phố", k: 0.9, full: true,
    items: [{ slug: S.pdz02, colors: ["Basic Gray"] }, { slug: S.b0711, colors: ["Be"] }, { slug: S.b9726, colors: ["Đen Basic"] }] },
  { image: "/lookbook/m3.webp", width: 617, height: 1285, title: "Dập nổi trắng, đi biển cùng máy ảnh", k: 0.95,
    items: [{ slug: S.pdz03, colors: ["White"] }, { slug: S.b1325, colors: ["Đen"] }, { slug: S.k5350, colors: ["Trắng"] }] },
  { image: "/lookbook/m4.webp", width: 1178, height: 1206, title: "Made in pain đen, tai nghe và balo", k: 0.9,
    items: [{ slug: S.pdz04, colors: ["Đen"] }, { slug: S.b9932, colors: [] }, { slug: S.b662, colors: ["Đen"] }] },
  { image: "/lookbook/m5.webp", width: 949, height: 1600, title: "Polo trắng, balo laptop",
    items: [{ slug: S.pdz05, colors: ["Trắng"] }, { slug: S.b9932, colors: [] }, { slug: S.b1325, colors: ["Kaki"] }] },
  { image: "/lookbook/m6.webp", width: 833, height: 1600, title: "Polo gân nâu, đi làm lịch sự",
    items: [{ slug: S.pdz06, colors: ["Nâu"] }, { slug: S.fa518, colors: ["Đen"] }, { slug: S.b662, colors: ["Đen"] }] },
  { image: "/lookbook/m7.webp", width: 1250, height: 1586, title: "Sharingan đen cho ngày đi học", k: 0.92,
    items: [{ slug: S.pdz07, colors: ["Đen"] }, { slug: S.b0711, colors: ["Đen"] }, { slug: S.fa518, colors: ["Đen"] }] },
  { image: "/lookbook/m8.webp", width: 429, height: 1228, title: "PDZ orb màu Cream, cargo đen", k: 0.9, full: true,
    items: [{ slug: S.pdz08, colors: ["Cream Orb"] }, { slug: S.b9726, colors: ["Xanh Đen"] }, { slug: S.b662, colors: ["Rêu"] }] },
];

export type RunwayOption = {
  color: string;
  imageUrl: string | null;
  variants: { id: string; size: string; price: number; originalPrice: number | null; stock: number }[];
};
export type RunwayItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  // In-stock colours the customer can pick from: the look's colours when any of them is in stock,
  // otherwise every colour in stock. One option = preselected.
  options: RunwayOption[];
  price: number;
  originalPrice: number | null;
};
export type RunwayLook = Omit<LookConfig, "items"> & { items: RunwayItem[] };

/** The looks with live product data. Inactive, missing or sold-out products drop out of their look. */
export function runwayLooks(bySlug: Map<string, ProductCardData>): RunwayLook[] {
  return LOOKS.map(({ items, ...look }) => ({
    ...look,
    items: items.flatMap(({ slug, colors }): RunwayItem[] => {
      const card = bySlug.get(slug);
      if (!card) return [];
      const inStock = (color: string) =>
        card.variants.filter((v) => v.color === color && v.stock > 0).toSorted((a, b) => sizeRank(a.size) - sizeRank(b.size));
      const all = [...new Set(card.variants.filter((v) => v.stock > 0).map((v) => v.color))];
      const wanted = colors.filter((c) => inStock(c).length);
      const options = (wanted.length ? wanted : all).map((color) => ({
        color,
        imageUrl: card.colors.find((c) => c.name === color)?.imageUrl ?? null,
        variants: inStock(color).map((v) => ({ id: v.id, size: v.size, price: v.price, originalPrice: v.original_price, stock: v.stock })),
      }));
      if (!options.length) return [];
      const [cheapest] = options.flatMap((o) => o.variants).toSorted((a, b) => a.price - b.price);
      return [{
        productId: card.id,
        slug: card.slug,
        name: card.name,
        imageUrl: options[0].imageUrl ?? card.imageUrl,
        options,
        price: cheapest.price,
        originalPrice: cheapest.originalPrice,
      }];
    }),
  }));
}
