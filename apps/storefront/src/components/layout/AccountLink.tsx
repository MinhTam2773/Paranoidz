"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@paranoidz/db/client";
import { UserIcon } from "./icons";

// Reads the session in the browser, so the layout stays cookie-free and ISR pages stay cached.
// Server HTML always says ĐĂNG NHẬP / ĐĂNG KÝ; a signed-in visitor sees it switch after hydration.
// `icon`: the header's icon-only button (2026-10-30: the label wrapped onto two lines there); the
// label stays for screen readers and as the hover title.
export function AccountLink({ className, icon, onClick }: { className: string; icon?: boolean; onClick?: () => void }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Fires once with the current session (INITIAL_SESSION), then on every login / logout.
    const { data } = createClient().auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  const label = signedIn ? "Tài khoản" : "Đăng nhập / Đăng ký";
  return (
    <Link href={signedIn ? "/account" : "/login"} onClick={onClick} className={className} title={icon ? label : undefined}>
      {icon && <UserIcon width={20} height={20} />}
      {icon ? <span className="sr-only">{label}</span> : label}
    </Link>
  );
}
