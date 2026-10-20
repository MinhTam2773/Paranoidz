// Gacha prize game "Chơi là có quà" (2026-10-20): shared prize metadata.
// The server owns the pool, the weights and every balance
// (supabase/migrations/20261020000001_gacha_game.sql); this file only names
// what a prize looks like on screen. Client-safe: no server imports.

export type GachaTier = "common" | "rare" | "epic" | "legendary";

export type GachaPrizeType = "voucher10" | "miss" | "voucher20" | "socks1" | "freeship" | "socks3" | "shirt";

export const GACHA_TIERS: Record<GachaTier, { label: string; color: string }> = {
  common: { label: "THƯỜNG", color: "#9aa3ad" },
  rare: { label: "HIẾM", color: "#4f8ff7" },
  epic: { label: "SIÊU HIẾM", color: "#a259e6" },
  legendary: { label: "RARE", color: "#f5b301" },
};

export const GACHA_PRIZES: Record<GachaPrizeType, { name: string; short: string; tier: GachaTier; img: string }> = {
  voucher10: { name: "Voucher ₫10.000 — đơn từ ₫150k", short: "Voucher ₫10K", tier: "common", img: "/gacha/voucher-10k.webp" },
  miss: { name: "Chúc may mắn lần sau", short: "Trượt", tier: "common", img: "/gacha/may-man.webp" },
  voucher20: { name: "Voucher ₫20.000 — đơn từ ₫249k", short: "Voucher ₫20K", tier: "rare", img: "/gacha/voucher-20k.webp" },
  socks1: { name: "Tặng 1 đôi vớ kèm đơn bất kỳ", short: "1 đôi vớ", tier: "rare", img: "/gacha/vo.webp" },
  freeship: { name: "Freeship 1 đơn bất kỳ", short: "Freeship", tier: "epic", img: "/gacha/freeship.webp" },
  socks3: { name: "Bộ 3 đôi vớ Paranoidz", short: "3 đôi vớ", tier: "epic", img: "/gacha/vo.webp" },
  shirt: { name: "Áo Paranoidz miễn phí", short: "Áo free", tier: "legendary", img: "/gacha/ao-rare.webp" },
};

// Carousel strip order (the draw weights live server-side only).
export const GACHA_POOL: GachaPrizeType[] = ["voucher10", "miss", "voucher20", "socks1", "freeship", "socks3", "shirt"];

export type GachaTaskId = "view3" | "cart" | "like" | "follow";

export const GACHA_TASKS: { id: GachaTaskId; name: string; reward: number }[] = [
  { id: "view3", name: "Xem 3 sản phẩm bất kỳ", reward: 1 },
  { id: "cart", name: "Thêm 1 sản phẩm vào giỏ", reward: 1 },
  { id: "like", name: "Like fanpage Paranoidz", reward: 1 },
  { id: "follow", name: "Theo dõi TikTok @paranoidz.vn", reward: 1 },
];

/** Name of the cookie that carries the player's opaque identity key (set by app/gacha/actions.ts). */
export const GACHA_COOKIE = "pdz_gacha";

/** Prize codes live in their own namespace so checkout never confuses them with promo vouchers. */
export function isGachaCode(code: string) {
  return code.trim().toUpperCase().startsWith("GACHA-");
}

export type GachaPrize = {
  code: string;
  prizeType: GachaPrizeType;
  tier: GachaTier;
  status: "issued" | "redeemed" | "expired";
  expiresAt: string;
  issuedAt: string;
};

export type GachaState = {
  spinsLeft: number;
  tasksToday: GachaTaskId[];
  prizes: GachaPrize[];
};

export type GachaSpinResult = {
  prizeType: GachaPrizeType;
  tier: GachaTier;
  code: string | null;
  expiresAt: string | null;
  spinsLeft: number;
};
