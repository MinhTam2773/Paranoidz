import Link from "next/link";
import { HOTLINE, POLICY_LINKS, SOCIAL_LINKS, STORE_ADDRESSES } from "@/lib/site";
import { SOCIAL_ICONS } from "./icons";

const heading = "text-caption font-semibold uppercase tracking-[0.06em] text-text-on-dark";
const muted = "text-caption text-text-on-dark/70";

// DESIGN.md §4 footer: dark, 4 columns (About / Policy / Store info / Fanpage),
// single column on mobile. COD is the only payment method (ARCHITECTURE.md §1).
export function Footer() {
  return (
    <footer className="bg-bg-dark text-text-on-dark">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="flex flex-col gap-4">
          <Link href="/" className="font-logo text-h2 italic uppercase tracking-[0.05em]">
            Paranoidz
          </Link>
          <p className={muted}>Streetwear designed in Vietnam.</p>
        </div>

        <nav aria-label="Policy" className="flex flex-col gap-4">
          <h2 className={heading}>Policy</h2>
          {POLICY_LINKS.map(({ label, href }) => (
            <Link key={href} href={href} className={`${muted} hover:text-text-on-dark`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-4">
          <h2 className={heading}>Store info</h2>
          {STORE_ADDRESSES.map(({ name, address }) => (
            <p key={name} className={muted}>
              {name}
              <br />
              {address}
            </p>
          ))}
          <p className="text-button">Hotline: {HOTLINE}</p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className={heading}>Fanpage</h2>
          <div className="flex gap-3">
            {SOCIAL_LINKS.map(({ label, href, icon }) => {
              const Icon = SOCIAL_ICONS[icon];
              return (
                <a key={label} href={href} aria-label={label} className="text-text-on-dark hover:opacity-70">
                  <Icon />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-text-on-dark/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <p className={muted}>© 2026 Paranoidz. All rights reserved.</p>
          <span className="w-fit rounded-sm border border-text-on-dark/30 px-2 py-1 text-caption font-semibold uppercase">
            COD
          </span>
        </div>
      </div>
    </footer>
  );
}
