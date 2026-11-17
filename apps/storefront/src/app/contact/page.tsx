import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BUSINESS, FACEBOOK_URL, HOTLINE, SHOPEE_URL, TEAM_NAME, TIKTOK_URL, ZALO_URL, websiteOpenGraph } from "@/lib/site";

// SEO kit 2026-11-17 (content/contact.md, eeat/contact-nap.md): one page with the shop's NAP and
// official channels, matching the footer and /policy. No opening hours or walk-in store and no
// LocalBusiness schema: the address is the business registration, not a shop to visit.
const TITLE = "Liên hệ Paranoidz — hotline, Zalo, địa chỉ";
const DESCRIPTION = `Liên hệ Paranoidz (${BUSINESS.legalName}): email ${BUSINESS.email}, hotline và Zalo ${HOTLINE}, địa chỉ ${BUSINESS.streetAddress}, TP.HCM.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { ...websiteOpenGraph("/contact"), title: TITLE, description: DESCRIPTION },
};

const link = "text-text-primary underline underline-offset-4 hover:text-accent";
const sectionTitle = "mb-4 border-l-4 border-accent pl-3 text-h3 uppercase";

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Liên hệ" }]} />
      <h1 className="mb-8 text-h2 uppercase">Liên hệ Paranoidz</h1>
      <div className="flex max-w-3xl flex-col gap-12 text-body text-text-secondary">
        <p>
          Paranoidz là shop online: bạn đặt hàng trên paranoidz.vn và nhận hàng qua SPX Express. Mọi câu hỏi về sản
          phẩm, size, đơn hàng hay đổi trả, shop hỗ trợ qua email, hotline và Zalo bên dưới.
        </p>

        <section aria-labelledby="nap-title">
          <h2 id="nap-title" className={sectionTitle}>Thông tin cửa hàng</h2>
          <ul className="flex flex-col gap-2">
            <li>Pháp nhân: {BUSINESS.legalName}</li>
            <li>Phụ trách: {TEAM_NAME}</li>
            <li>Mã số doanh nghiệp / mã số thuế: {BUSINESS.taxId}</li>
            <li>Địa chỉ đăng ký: {BUSINESS.streetAddress}, {BUSINESS.locality}, Việt Nam</li>
            <li>
              Email: <a href={`mailto:${BUSINESS.email}`} className={link}>{BUSINESS.email}</a>
            </li>
            <li>
              Hotline: <a href={`tel:${HOTLINE.replace(/\s/g, "")}`} className={link}>{HOTLINE}</a>
            </li>
            <li>
              Zalo: <a href={ZALO_URL} target="_blank" rel="noopener noreferrer" className={link}>zalo.me/0345267709</a>
            </li>
            <li>Website: paranoidz.vn</li>
          </ul>
        </section>

        <section aria-labelledby="order-title">
          <h2 id="order-title" className={sectionTitle}>Đơn hàng và đổi trả</h2>
          <div className="flex flex-col gap-4">
            <p>
              Muốn biết đơn đang ở đâu, vào <Link href="/order-lookup" className={link}>tra cứu đơn hàng</Link> và
              nhập mã đơn cùng số điện thoại đặt hàng. Muốn trả hàng, gửi yêu cầu ngay ở trang tra cứu trong 7 ngày kể
              từ khi nhận: shop gửi SPX đến lấy và chịu phí vận chuyển trả hàng. Đổi size hoặc đổi mẫu, liên hệ hotline
              hoặc email; bạn chịu phí vận chuyển phát sinh.
            </p>
            <p>
              Điều kiện đầy đủ về giao hàng, thanh toán, đổi trả, bảo mật và khiếu nại nằm ở trang{" "}
              <Link href="/policy" className={link}>chính sách</Link>.
            </p>
          </div>
        </section>

        <section aria-labelledby="channels-title">
          <h2 id="channels-title" className={sectionTitle}>Kênh chính thức</h2>
          <p className="mb-4">
            Ngoài website, Paranoidz bán và trả lời khách qua các kênh dưới đây.
          </p>
          <ul className="flex flex-col gap-2">
            <li>
              Facebook: <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={link}>facebook.com/paranoidz.vn</a>
            </li>
            <li>
              TikTok: <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className={link}>@paranoidz.vn</a>
            </li>
            <li>
              Shopee: <a href={SHOPEE_URL} target="_blank" rel="noopener noreferrer" className={link}>shopee.vn/paranoidz.studio</a>
            </li>
          </ul>
        </section>

        <p>
          Tìm hiểu thêm về thương hiệu ở trang <Link href="/branding" className={link}>Paranoidz là gì?</Link>
        </p>
      </div>
    </div>
  );
}
