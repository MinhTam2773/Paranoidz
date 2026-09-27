"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@paranoidz/db/client";
import { UserIcon } from "./icons";

// Reads the session in the browser, so the layout stays cookie-free and ISR pages stay cached.
// Server HTML always says LOGIN / REGISTER; a signed-in visitor sees it switch after hydration.
export function AccountLink({ className, icon, onClick }: { className: string; icon?: boolean; onClick?: () => void }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Fires once with the current session (INITIAL_SESSION), then on every login / logout.
    const { data } = createClient().auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <Link href={signedIn ? "/account" : "/login"} onClick={onClick} className={className}>
      {icon && <UserIcon width={20} height={20} />}
      {signedIn ? "Account" : "Login / Register"}
    </Link>
  );
}
