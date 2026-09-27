"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@paranoidz/db/client";
import { secondaryClass } from "./styles";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={logout} disabled={pending} className={secondaryClass}>
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
