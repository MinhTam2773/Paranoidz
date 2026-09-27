"use client";

import { useState } from "react";
import { createClient } from "@paranoidz/db/client";
import { secondaryClass } from "./styles";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "facebook", label: "Continue with Facebook" },
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
      setError("Couldn't start that sign-in. Try again, or use your email.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="mb-3 flex items-center gap-3 text-caption uppercase text-text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        or
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
