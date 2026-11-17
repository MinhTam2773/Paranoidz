import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BadgeCheckIcon, GemIcon, SparklesIcon } from "@/components/layout/icons";
import { BUSINESS, HOTLINE, SHOPEE_URL, SITE_URL, TEAM_NAME, breadcrumbJsonLd, websiteOpenGraph } from "@/lib/site";
import beach from "../../../public/branding/beach.jpg";
import bedroom from "../../../public/branding/bedroom.jpg";
import cafe from "../../../public/branding/cafe.jpg";
import embroidery from "../../../public/branding/embroidery.jpg";
import polo from "../../../public/branding/polo.jpg";
import studio from "../../../public/branding/studio.jpg";

// SEO (audit 2026-10-30, SEO kit 2026-11-17 content/branding-about.md): the About page answers
// "Paranoidz là gì?" with the legal entity, a name disambiguation (AI search confused the brand
// with Paradox / Paranoid) and where to buy.
const TITLE = "Paranoidz là gì? Local brand streetwear Việt Nam";
const DESCRIPTION =
  "Paranoidz (paranoidz.vn) là local brand streetwear của Hộ kinh doanh COOLSHIRTZ, TP.HCM. Áo thun, polo form boxy và oversize, sản xuất tại Việt Nam, đổi trả 7 ngày.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/branding" },
  openGraph: {
    ...websiteOpenGraph("/branding"),
    title: TITLE,
    description: DESCRIPTION,
  },
};

const CRUMBS = [{ label: "Trang chủ", href: "/" }, { label: "Thương hiệu" }];

const ABOUT_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${SITE_URL}/branding#webpage`,
      url: `${SITE_URL}/branding`,
      name: TITLE,
      inLanguage: "vi",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
      mainEntity: { "@id": `${SITE_URL}/#organization` },
    },
    breadcrumbJsonLd(CRUMBS, "/branding"),
  ],
};

const linkClass = "text-text-primary underline underline-offset-4 hover:text-accent";

// Brand story (Stitch "PARANOIDZ - Branding Page", spec 2026-10-11 §2). The hero is a dark block,
// not a photo: DESIGN.md keeps the hero banner for the homepage.
// Photos: the client's (Drive, 2026-10-12), resized to ≤ 1600px with metadata stripped.
// PLACEHOLDER — copy translated from the Stitch mock-up; the client supplies the real text.
const PHILOSOPHY = [
  "Sinh ra giữa những khu phố bê tông của Việt Nam, PARANOIDZ là lời đáp trả trước sự ồn ào của thời trang nhanh. Chúng tôi tin rằng sự nổi loạn thật sự không cần phải hét lên — nó nằm ở độ chính xác của từng đường cắt, sức nặng của chất vải và hình dáng của một chiếc bóng.",
  "Gốc rễ từ văn hoá underground Sài Gòn có mặt trong mọi bộ sưu tập. Chúng tôi kết hợp chất liệu kỹ thuật với tinh thần streetwear thô mộc, tạo nên lớp áo giáp cho người trẻ thành thị — những người đi qua hỗn loạn bằng sự điềm tĩnh.",
  "Chất lượng là điều chúng tôi ám ảnh. Mỗi đường may là một cam kết về độ bền, để sản phẩm theo bạn qua mọi va chạm của đường phố mà vẫn giữ nguyên phom dáng. Bản sắc là một tấm canvas — và chúng tôi mang đến những gam màu đầu tiên.",
];

const VALUES = [
  { Icon: BadgeCheckIcon, title: "Chân thật", text: "Trung thành với đường phố và văn hoá underground đã sinh ra chúng tôi. Không thoả hiệp." },
  { Icon: GemIcon, title: "Chất lượng", text: "Chất liệu cao cấp, đường may tỉ mỉ. Bền bỉ trước nhịp sống đô thị." },
  { Icon: SparklesIcon, title: "Đổi mới", text: "Không ngừng mở rộng giới hạn của streetwear với phom dáng mới và thiết kế linh hoạt." },
];

// The box (aspect / grid span) comes from className; the photo covers it.
function Photo({ src, alt, sizes, className }: { src: StaticImageData; alt: string; sizes: string; className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-sm bg-bg-tertiary ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} placeholder="blur" className="object-cover" />
    </div>
  );
}

// Section title with the vertical accent bar (DESIGN.md §4), as on the homepage.
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 border-l-4 border-accent pl-3 text-h2 uppercase">{children}</h2>;
}

export default function BrandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ABOUT_JSON_LD).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        <Breadcrumb items={CRUMBS} />
      </div>

      <section className="bg-bg-dark px-4 py-24 text-center text-text-on-dark">
        <h1 className="text-h1-mobile uppercase lg:text-h1">Paranoidz là gì?</h1>
        <p className="mt-4 text-body italic text-text-on-dark/80">Định nghĩa lại bản sắc đường phố bằng thiết kế tối giản.</p>
      </section>

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-16 text-body text-text-secondary lg:px-6">
        <p>
          Paranoidz là local brand streetwear Việt Nam, website chính thức paranoidz.vn. Shop bán áo thun và polo
          unisex (form boxy, oversize, polo cổ bẻ), kèm balo, túi và phụ kiện. Pháp nhân: {BUSINESS.legalName}, mã số
          doanh nghiệp / mã số thuế {BUSINESS.taxId}, địa chỉ {BUSINESS.streetAddress}, {BUSINESS.locality}. Người
          phụ trách: {TEAM_NAME}.
        </p>
        <p>
          Sinh ra từ văn hoá đường phố Sài Gòn, Paranoidz làm áo với hình thêu và dập nổi, chú trọng form và chất vải
          hơn là in áo thời trang nhanh. 100% sản xuất tại Việt Nam — từ vải, cắt may đến thêu họa tiết.{" "}
          <Link href="/collections/t-shirtz" className={linkClass}>Xem các mẫu áo</Link>.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 lg:grid-cols-2 lg:gap-12 lg:px-6">
        <div>
          <SectionTitle>Triết lý</SectionTitle>
          <div className="flex flex-col gap-4 text-body text-text-secondary">
            {PHILOSOPHY.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Photo src={embroidery} alt="Hình thêu chữ パラノイズ trên áo polo đen" sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw" className="mt-8 aspect-3/4" />
          <Photo src={studio} alt="Người mẫu mặc áo thun Paranoidz màu be" sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw" className="aspect-3/4" />
        </div>
      </section>

      <section className="bg-bg-secondary px-4 py-16">
        <ul className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-3">
          {VALUES.map(({ Icon, title, text }) => (
            <li key={title} className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-sm border border-border bg-bg-primary">
                <Icon />
              </span>
              <h3 className="text-h3 uppercase">{title}</h3>
              <p className="max-w-xs text-caption text-text-secondary">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-16 lg:grid-cols-2 lg:px-6">
        <div>
          <SectionTitle>Phân biệt tên</SectionTitle>
          <p className="text-body text-text-secondary">
            Paranoidz (chữ z, domain paranoidz.vn, pháp nhân {BUSINESS.legalName} tại TP.HCM) không phải Paradox
            (paradox.vn), không phải PARANOID ở Toronto (weareparanoid.com), không phải shop Paranoid ở Hà Nội
            (paranoidsg.com). Cũng không phải thuật ngữ y khoa “paranoid”.
          </p>
        </div>
        <div>
          <SectionTitle>Mua ở đâu</SectionTitle>
          <div className="flex flex-col gap-3 text-body text-text-secondary">
            <p>
              Website paranoidz.vn,{" "}
              <a href={SHOPEE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Shopee</a>, TikTok
              @paranoidz.vn và Facebook paranoidz.vn. Thanh toán khi nhận hàng (COD, được kiểm hàng trước khi trả tiền)
              hoặc chuyển khoản VietQR. Giao SPX Express: nội thành TP.HCM 1–2 ngày, tỉnh thành khác 2–5 ngày làm việc.
            </p>
            <p>
              Đổi trả trong 7 ngày theo <Link href="/policy#returns" className={linkClass}>chính sách đổi trả</Link>.
              Xem <Link href="/feedback" className={linkClass}>đánh giá của khách</Link> hoặc{" "}
              <Link href="/contact" className={linkClass}>liên hệ shop</Link>: hotline / Zalo {HOTLINE}, email{" "}
              {BUSINESS.email}.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-6">
        <SectionTitle>Đời sống Paranoidz</SectionTitle>
        {/* lg: large 2×2 | two stacked squares | tall 1×2. Mobile: large on top, then square + tall + square. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Photo src={bedroom} alt="Người mẫu mặc áo thun đen in nổi chữ paranoidz trong phòng ngủ" sizes="(min-width: 1280px) 616px, (min-width: 1024px) 50vw, 100vw" className="col-span-2 aspect-square lg:row-span-2 lg:aspect-auto" />
          <Photo src={polo} alt="Người mẫu mặc áo polo nâu thêu hình đại bàng" sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw" className="aspect-square" />
          <Photo src={cafe} alt="Người mẫu mặc áo thun trắng thêu hình đôi mắt trong quán cà phê" sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw" className="row-span-2" />
          <Photo src={beach} alt="Người mẫu mặc áo thun trắng Paranoidz trên ghềnh đá ven biển" sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, 50vw" className="aspect-square" />
        </div>
      </section>
    </>
  );
}
