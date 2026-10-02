"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@paranoidz/db/client";
import { isActive, NAV_ITEMS, pageTitle, STORE_URL } from "@/lib/nav";
import { CloseIcon, LogoutIcon, MenuIcon } from "./icons";

const linkClass =
  "flex h-12 items-center gap-3 border-l-3 px-5 text-sidebar-link uppercase transition-colors duration-200";

// DASHBOARD_DESIGN.md §4: fixed dark sidebar ≥768px; below that the same sidebar
// slides in from the left behind a hamburger in the topbar.
export function AdminShell({ email, pendingCount, children }: { email: string; pendingCount: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      {menuOpen && <div aria-hidden="true" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-bg-dark/50 md:hidden" />}
      <aside
        aria-label="Điều hướng quản trị"
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar-bg text-sidebar-text transition-[translate,visibility] duration-300 md:visible md:translate-x-0 ${
          // invisible while closed on mobile, so the off-screen links leave the tab order
          menuOpen ? "translate-x-0 shadow-3" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-2">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex flex-col leading-none">
            <span className="font-logo text-page-title italic uppercase tracking-[0.05em]">Paranoidz</span>
            <span className="text-stat-label uppercase text-text-muted">Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Đóng menu"
            className="flex size-12 items-center justify-center md:hidden"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`${linkClass} ${
                  active
                    ? "border-sidebar-active bg-sidebar-active/10 text-sidebar-text"
                    : "border-transparent text-sidebar-text/70 hover:bg-sidebar-text/6 hover:text-sidebar-text"
                }`}
              >
                <Icon className={active ? "text-sidebar-active" : undefined} />
                <span className="flex-1">{label}</span>
                {href === "/orders" && pendingCount > 0 && (
                  <span
                    aria-label={`${pendingCount} đơn chờ xác nhận`}
                    className="min-w-6 rounded-sm bg-accent px-1.5 py-1 text-center text-badge text-text-on-dark"
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <LogoutButton />
      </aside>

      <div className="flex min-h-screen flex-col md:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface px-2 md:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            className="flex size-12 items-center justify-center md:hidden"
          >
            <MenuIcon />
          </button>
          <h1 className="flex-1 truncate text-page-title uppercase">{pageTitle(pathname)}</h1>
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener"
            className="hidden text-label uppercase text-text-secondary hover:text-text-primary sm:block"
          >
            Xem cửa hàng ↗
          </a>
          <span
            title={email}
            className="ml-2 mr-2 flex size-8 items-center justify-center rounded-sm bg-bg-dark text-badge uppercase text-text-on-dark md:mr-0"
          >
            {email.charAt(0) || "A"}
          </span>
        </header>
        <main className="w-full max-w-content flex-1 p-6">{children}</main>
      </div>
    </>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    // "local": only this browser's session; the owner's storefront sessions stay signed in.
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className={`${linkClass} mb-4 border-transparent text-sidebar-text/70 hover:bg-sidebar-text/6 hover:text-sidebar-text disabled:opacity-50`}
    >
      <LogoutIcon />
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
  );
}
