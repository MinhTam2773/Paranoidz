import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { HOTLINE } from "@/lib/site";

export const metadata: Metadata = { title: "Chính sách | Paranoidz" };

const link = "text-text-primary underline underline-offset-4 hover:text-accent";

// Shipping / returns / privacy; the ids match the footer's POLICY_LINKS anchors (lib/site.ts).
// PLACEHOLDER — client to approve. Drafted from what the shop actually does (COD only, SPX rate per
// province, the checkout fields); the return terms in [brackets] are not decided yet.
const SECTIONS: { id: string; title: string; body: ReactNode[] }[] = [
  {
    id: "shipping",
    title: "Chính sách giao hàng",
    body: [
      "Paranoidz giao hàng toàn quốc qua đơn vị vận chuyển SPX Express.",
      "Thanh toán khi nhận hàng (COD): bạn chỉ trả tiền khi nhận được hàng. Cửa hàng chưa hỗ trợ thanh toán trực tuyến.",
      "Phí giao hàng tính theo bảng giá SPX cho từng tỉnh/thành và hiển thị ở bước thanh toán, trước khi bạn đặt hàng.",
      <>
        Sau khi đặt hàng, bạn có thể theo dõi đơn tại trang{" "}
        <Link href="/order-lookup" className={link}>Tra cứu đơn hàng</Link> bằng mã đơn (PZ-…) và số điện thoại đặt hàng.
      </>,
    ],
  },
  {
    id: "returns",
    title: "Chính sách đổi trả",
    body: [
      "Bạn có thể yêu cầu đổi hàng trong vòng [số ngày] ngày kể từ khi nhận hàng.",
      "Sản phẩm đổi cần [điều kiện, ví dụ: còn nguyên tem mác, chưa qua sử dụng, chưa giặt].",
      "Phí vận chuyển khi đổi hàng do [cửa hàng / khách hàng] chi trả.",
      `Để yêu cầu đổi hàng, gọi hotline ${HOTLINE} và cung cấp mã đơn hàng.`,
    ],
  },
  {
    id: "privacy",
    title: "Chính sách bảo mật",
    body: [
      "Khi đặt hàng, chúng tôi thu thập họ tên, số điện thoại, địa chỉ giao hàng và email (nếu bạn cung cấp). Khi bạn tạo tài khoản, chúng tôi lưu thêm email đăng nhập và các địa chỉ bạn đã lưu.",
      "Thông tin này chỉ dùng để xử lý, giao đơn hàng và liên hệ với bạn về đơn hàng. Chúng tôi không bán thông tin của bạn và chỉ chia sẻ với đơn vị vận chuyển để giao hàng.",
      "Trang web dùng cookie và bộ nhớ trình duyệt để giữ đăng nhập, giỏ hàng và danh sách yêu thích.",
      `Để xem, sửa hoặc xoá thông tin của bạn, gọi hotline ${HOTLINE}.`,
    ],
  },
];

export default function PolicyPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Chính sách" }]} />
      <h1 className="mb-8 text-h2 uppercase">Chính sách</h1>
      <div className="flex max-w-3xl flex-col gap-12">
        {SECTIONS.map(({ id, title, body }) => (
          // scroll-mt clears the sticky header (64px mobile, 112px with the desktop nav row)
          <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 lg:scroll-mt-32">
            <h2 id={`${id}-title`} className="mb-4 border-l-4 border-accent pl-3 text-h3 uppercase">{title}</h2>
            <div className="flex flex-col gap-3 text-body text-text-secondary">
              {body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
