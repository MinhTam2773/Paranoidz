import { ArticlePage, articleMetadata } from "@/components/content/ArticlePage";
import { ARTICLES } from "@/content/articles";
import { HOTLINE, SITE_URL } from "@/lib/site";

// Size guide from the SEO kit (P2.3): per-model tables copied from the product pages, no shared
// chart and no pdz07 table (its data is broken in the admin, owner to fix). HowTo per
// jsonld/howto-chon-size.json.
const PATH = "/huong-dan-chon-size";
const article = ARTICLES["huong-dan-chon-size"];

export const metadata = articleMetadata(article, PATH);

const HOWTO = {
  "@type": "HowTo",
  "@id": `${SITE_URL}${PATH}#howto`,
  name: "Cách chọn size áo thun Paranoidz",
  inLanguage: "vi",
  description: "Paranoidz không dùng một bảng size chung. Đối chiếu bảng trên đúng trang sản phẩm đang mua.",
  step: [
    { name: "Mở đúng trang sản phẩm", text: "Mỗi mẫu (pdz01, pdz03, pdz05…) có bảng size riêng. Đừng dùng bảng của mẫu khác." },
    {
      name: "Đối chiếu cân nặng hoặc số đo cm",
      text: "Một số mẫu chỉ ghi mốc kg (ví dụ pdz01: M 40–55, L 55–65, XL 65–80). Một số mẫu polo có thêm số đo cm và ghi chú người mẫu.",
    },
    {
      name: "Đọc ghi chú form trên trang sản phẩm",
      text: "Ví dụ polo oversize pdz05: mẫu 1m80 / 65kg mặc XL; không tăng size trừ khi muốn rộng hơn nữa.",
    },
    {
      name: "Hỏi shop nếu còn phân vân",
      text: `Nhắn hotline hoặc Zalo ${HOTLINE}. Đổi size trong 7 ngày theo chính sách, khách chịu phí vận chuyển phát sinh.`,
    },
  ].map((s, i) => ({ "@type": "HowToStep", position: i + 1, ...s })),
};

export default function SizeGuidePage() {
  return (
    <ArticlePage
      article={article}
      path={PATH}
      crumbs={[]}
      extraJsonLd={HOWTO}
      related={[
        { label: ARTICLES["ao-thun-boxy-va-oversize-khac-nhau"].h1, href: "/blog/ao-thun-boxy-va-oversize-khac-nhau" },
        { label: ARTICLES["cach-phoi-ao-thun-local-brand"].h1, href: "/blog/cach-phoi-ao-thun-local-brand" },
        { label: "Xem tất cả áo thun", href: "/collections/t-shirtz" },
      ]}
    />
  );
}
