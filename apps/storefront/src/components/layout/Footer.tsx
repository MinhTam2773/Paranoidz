import Link from "next/link";
import { HOTLINE, POLICY_LINKS } from "@/lib/site";
import { Logo } from "./Logo";

const heading = "text-caption font-semibold uppercase tracking-[0.06em] text-text-on-dark";
const muted = "text-caption text-text-on-dark/70";

// Social links (2026-10-16, Tủn supplied).
const SOCIALS = [
  { label: "TIKTOK", href: "https://www.tiktok.com/@paranoidz.vn" },
  { label: "FANPAGE", href: "https://www.facebook.com/paranoidz.vn/" },
  { label: "ZALO", href: "https://zalo.me/0345267709" },
] as const;

// Footer (2026-10-16): logo image, business info (Hộ kinh doanh COOLSHIRTZ),
// social rows like the Hydra reference, contact, policies.
export function Footer() {
  return (
    <footer className="bg-bg-dark text-text-on-dark">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="flex flex-col gap-4">
          <Logo dark />
          <div className={muted}>
            <p className="font-semibold uppercase text-text-on-dark">Hộ kinh doanh COOLSHIRTZ</p>
            <p className="mt-1">Mã số doanh nghiệp: 042097005182</p>
          </div>
        </div>

        <nav aria-label="Kết nối với Paranoidz" className="flex flex-col gap-4">
          <h2 className={heading}>Kết nối với Paranoidz</h2>
          <ul className="flex flex-col">
            {SOCIALS.map(({ label, href }) => (
              <li key={label} className="border-b border-text-on-dark/10">
                <a
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex items-center justify-between py-2.5 text-caption uppercase tracking-[0.06em] text-text-on-dark/80 hover:text-text-on-dark"
                >
                  {label}
                  <span aria-hidden>↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4">
          <h2 className={heading}>Liên hệ</h2>
          <p className={muted}>
            <a href="mailto:support@paranoidz.vn" className="hover:text-text-on-dark">
              support@paranoidz.vn
            </a>
          </p>
          <p className={muted}>57/41/17 Tô Hiệu, P. Phú Thạnh, TP.HCM</p>
          <p className="text-button">Hotline: {HOTLINE}</p>
        </div>

        <nav aria-label="Chính sách" className="flex flex-col gap-4">
          <h2 className={heading}>Chính sách</h2>
          {POLICY_LINKS.map(({ label, href }) => (
            <Link key={href} href={href} className={`${muted} hover:text-text-on-dark`}>
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-text-on-dark/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <p className={muted}>© 2026 Paranoidz. Bảo lưu mọi quyền.</p>
          <span className="w-fit rounded-sm border border-text-on-dark/30 px-2 py-1 text-caption font-semibold uppercase">
            COD
          </span>
        </div>
      </div>
    </footer>
  );
}
