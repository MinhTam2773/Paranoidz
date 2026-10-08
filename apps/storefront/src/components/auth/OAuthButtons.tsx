"use client";

import { useState } from "react";
import { createClient } from "@paranoidz/db/client";
import { secondaryClass } from "./styles";

const PROVIDERS = [
  { id: "google", label: "Tiếp tục với Google" },
  { id: "facebook", label: "Tiếp tục với Facebook" },
] as const;

// Leaves the site for the provider; /auth/callback exchanges the code and sends the user
// on through the phone step (OAuth accounts arrive without a phone).
export function OAuthButtons({ next }: { next: string }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function signIn(provider: (typeof PROVIDERS)[number]["id"]) {
    setBusy(true);
    setError(undefined);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // Success navigates away; only a failure to start comes back here.
    if (error) {
      setError("Không thể bắt đầu đăng nhập. Vui lòng thử lại, hoặc dùng email.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="mb-3 flex items-center gap-3 text-caption uppercase text-text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        hoặc
      </p>
      {PROVIDERS.map(({ id, label }) => (
        <button key={id} type="button" disabled={busy} onClick={() => signIn(id)} className={secondaryClass}>
          {label}
        </button>
      ))}
      {error && <p role="alert" className="text-caption text-accent">{error}</p>}
    </div>
  );
}
