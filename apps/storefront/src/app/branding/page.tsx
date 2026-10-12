import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BadgeCheckIcon, GemIcon, SparklesIcon } from "@/components/layout/icons";

export const metadata: Metadata = { title: "Thương hiệu | Paranoidz" };

// Brand story (Stitch "PARANOIDZ - Branding Page", spec 2026-10-11 §2). The hero is a dark block,
// not a photo: DESIGN.md keeps the hero banner for the homepage.
// PLACEHOLDER — copy translated from the Stitch mock-up, grey photo slots. The client supplies the real
// text and photos; a photo goes in as <Image fill className="object-cover" /> inside the same slot.
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

function PhotoSlot({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-sm bg-bg-tertiary ${className}`} />;
}

// Section title with the vertical accent bar (DESIGN.md §4), as on the homepage.
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 border-l-4 border-accent pl-3 text-h2 uppercase">{children}</h2>;
}

export default function BrandingPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Thương hiệu" }]} />
      </div>

      <section className="bg-bg-dark px-4 py-24 text-center text-text-on-dark">
        <h1 className="text-h1-mobile uppercase lg:text-h1">Câu chuyện Paranoidz</h1>
        <p className="mt-4 text-body italic text-text-on-dark/80">Định nghĩa lại bản sắc đường phố bằng thiết kế tối giản.</p>
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
          <PhotoSlot className="mt-8 aspect-3/4" />
          <PhotoSlot className="aspect-3/4" />
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

      <section className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-6">
        <SectionTitle>Đời sống Paranoidz</SectionTitle>
        {/* lg: large 2×2 | two stacked squares | tall 1×2. Mobile: large on top, then square + tall + square. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PhotoSlot className="col-span-2 aspect-square lg:row-span-2 lg:aspect-auto" />
          <PhotoSlot className="aspect-square" />
          <PhotoSlot className="row-span-2" />
          <PhotoSlot className="aspect-square" />
        </div>
      </section>
    </>
  );
}
