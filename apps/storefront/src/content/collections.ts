// Vietnamese collection names and SEO copy (SEO kit 2026-11-17, content/collections.md; the owner
// approved renaming the menu on 2026-11-17). Slugs stay as they are. Keyed by slug, these win
// over the admin's collections.name / description for H1, title, breadcrumb and cards, so the
// rename doesn't depend on editing each collection in the admin. Remove an entry to hand that
// collection back to the admin. Intros use the markdown subset of components/content/Prose.tsx.

export type CollectionCopy = { name: string; title: string; h1: string; description: string; intro: string };

export const COLLECTION_COPY: Record<string, CollectionCopy> = {
  "t-shirtz": {
    name: "Áo thun",
    title: "Áo thun local brand unisex, form rộng | Paranoidz",
    h1: "Áo thun local brand — form boxy, oversize và polo",
    description:
      "Áo thun và polo local brand Paranoidz: form boxy, oversize, vải nhung hoặc cotton. Sản xuất tại Việt Nam, đổi trả 7 ngày, thanh toán COD hoặc VietQR.",
    intro: `Paranoidz là local brand streetwear Việt Nam. Bộ sưu tập áo thun và polo trên trang này gồm các mẫu thiết kế sẵn của shop: áo thun form boxy thêu nổi (dòng vải nhung), áo thun form rộng dập nổi cotton 250gsm, áo thun thêu form oversize, polo oversize và polo vải gân form ôm.

Size phổ biến là M, L, XL — số đo và gợi ý cân nặng nằm ở từng trang sản phẩm vì các dòng không dùng chung một bảng. Đang phân vân? Đọc [form boxy và oversize khác nhau thế nào](/blog/ao-thun-boxy-va-oversize-khac-nhau) và [hướng dẫn chọn size](/huong-dan-chon-size).

Áo được sản xuất tại Việt Nam. Thanh toán khi nhận hàng (COD, được kiểm hàng trước khi trả tiền) hoặc chuyển khoản VietQR. Giao SPX Express toàn quốc: nội thành TP.HCM 1–2 ngày, tỉnh thành khác 2–5 ngày làm việc. Đổi trả trong 7 ngày theo [chính sách](/policy#returns).`,
  },
  backpackz: {
    name: "Balo",
    title: "Balo đi học, balo đựng laptop | Paranoidz",
    h1: "Balo đi học và balo đựng laptop",
    description:
      "Balo đi học, balo nữ, balo đựng laptop đang bán tại Paranoidz. Thanh toán COD hoặc VietQR, giao SPX toàn quốc, đổi trả 7 ngày theo chính sách shop.",
    intro: `Ngoài áo thun local brand, Paranoidz còn bán balo trên paranoidz.vn: balo đi học, balo phong cách ulzzang, balo đựng laptop, balo denim và một số mẫu khác — tên, giá, màu và mô tả nằm ở từng trang sản phẩm.

Giao hàng toàn quốc qua SPX Express, nhận COD (kiểm hàng trước khi thanh toán) hoặc chuyển khoản VietQR. Đổi trả trong 7 ngày, sản phẩm còn nguyên tem mác và chưa sử dụng, theo [chính sách đổi trả](/policy#returns). Tìm áo thun local brand? Xem bộ sưu tập [Áo thun](/collections/t-shirtz).`,
  },
  bagz: {
    name: "Túi",
    title: "Túi tote, túi đeo chéo nam nữ | Paranoidz",
    h1: "Túi tote và túi đeo chéo",
    description:
      "Túi tote, túi đeo chéo và túi xách đang bán tại Paranoidz. Thanh toán COD hoặc VietQR, giao SPX toàn quốc, đổi trả 7 ngày. Xem từng sản phẩm để biết size và chất liệu.",
    intro: `Túi tote, túi đeo chéo nam, túi xách và một số kiểu túi khác đang bán trên paranoidz.vn. Chất liệu, kích thước, màu và giá nằm ở trang từng sản phẩm.

Trên trang chủ, một số túi được phối cùng áo PDZ trong mục “Phối cùng PDZ” — gợi ý phối đồ từ shop. Thanh toán COD hoặc VietQR, giao SPX, đổi trả 7 ngày theo [chính sách](/policy#returns).`,
  },
  accessoriez: {
    name: "Phụ kiện",
    title: "Phụ kiện Paranoidz — tất vớ và quà tặng kèm",
    h1: "Phụ kiện và quà tặng kèm",
    description:
      "Phụ kiện đang bán tại Paranoidz, gồm tất vớ unisex và quà tặng kèm đơn. Local brand streetwear Việt Nam, giao SPX, thanh toán COD hoặc VietQR.",
    intro: `Các món nhỏ đi kèm hoặc bán thêm, như tất vớ unisex và quà tặng kèm đơn.

Tìm áo thun hoặc polo local brand? Vào [Áo thun](/collections/t-shirtz). Giao hàng, thanh toán và đổi trả áp dụng như các sản phẩm khác, chi tiết tại [chính sách](/policy).`,
  },
};

export const collectionName = (slug: string, adminName: string) => COLLECTION_COPY[slug]?.name ?? adminName;
