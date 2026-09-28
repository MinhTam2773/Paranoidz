"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createClient } from "@paranoidz/db/client";
import { CloseIcon } from "@/components/layout/icons";
import { afterLoginPath } from "@/lib/auth";
import { clearPendingWishlist } from "@/lib/wishlist";
import { LoginForm } from "./LoginForm";

const OPEN_EVENT = "pz:open-login";

/** Opens the login modal (mounted once in the root layout) over the current page. */
export function openLogin() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

// Login without leaving the page (Stitch "Login Modal"). Native <dialog>: focus stays inside, Esc
// closes, the page behind is inert. Password login finishes here; Google/Facebook, signup and
// password reset leave for their pages with ?next= this page. Signup lives on /register only —
// it needs name + phone and an email confirmation, which a modal can't finish.
export function LoginModal() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const signedIn = useRef(false);
  const leftViaLink = useRef(false);
  const [next, setNext] = useState<string | null>(null); // null = closed

  useEffect(() => {
    const open = () => {
      signedIn.current = false;
      leftViaLink.current = false;
      setNext(location.pathname + location.search);
      dialogRef.current?.showModal();
      document.body.style.overflow = "hidden";
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  function onClose() {
    document.body.style.overflow = "";
    setNext(null);
    // Closed without logging in: forget the heart tap that opened it. Leaving for /register or
    // /forgot-password keeps it — that login can still finish (the link returns to this page).
    if (!signedIn.current && !leftViaLink.current) clearPendingWishlist();
  }

  async function onSignedIn() {
    signedIn.current = true;
    const { data } = await createClient().from("profiles").select("phone").maybeSingle();
    dialogRef.current?.close();
    // Same rule as every login: no phone yet → the phone step, which returns to this page.
    if (!data?.phone) router.push(afterLoginPath(next ?? "/"));
    else router.refresh();
  }

  // A click on the dialog element itself (not its content) is a click on the backdrop. A link
  // inside (register, forgot password) navigates away, and the layout — this modal included —
  // stays mounted, so close it on the way out.
  function onClick(e: MouseEvent<HTMLDialogElement>) {
    if ((e.target as Element).closest("a")) {
      leftViaLink.current = true;
      dialogRef.current?.close();
    } else if (e.target === dialogRef.current) dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={onClick}
      aria-labelledby="login-modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-sm bg-bg-primary p-0 text-text-primary shadow-3 backdrop:bg-bg-dark/60"
    >
      {next !== null && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-y-auto">
          <div className="relative flex h-16 shrink-0 items-center justify-center border-b border-border">
            <span className="font-logo text-h3 italic uppercase tracking-[0.05em]">Paranoidz</span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="absolute right-2 flex size-11 items-center justify-center"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex flex-col gap-2 p-6">
            <h2 id="login-modal-title" className="text-h3 uppercase">Log in</h2>
            <p className="mb-4 text-text-secondary">Log in to save products to your wishlist.</p>
            <LoginForm next={next} onSignedIn={onSignedIn} />
          </div>
        </div>
      )}
    </dialog>
  );
}
