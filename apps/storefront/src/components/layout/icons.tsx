// Inline stroke icons (24px grid, currentColor) — no icon dependency.
import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const SearchIcon = (p: P) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
export const UserIcon = (p: P) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>
);
export const BagIcon = (p: P) => (
  <Icon {...p}><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Icon>
);
export const MenuIcon = (p: P) => (
  <Icon {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Icon>
);
export const CloseIcon = (p: P) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const FacebookIcon = (p: P) => (
  <Icon {...p}><path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2V3Z" /></Icon>
);
export const InstagramIcon = (p: P) => (
  <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></Icon>
);
export const TikTokIcon = (p: P) => (
  <Icon {...p}><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3a5 5 0 0 0 5 5" /></Icon>
);

export const SOCIAL_ICONS = { facebook: FacebookIcon, instagram: InstagramIcon, tiktok: TikTokIcon };
