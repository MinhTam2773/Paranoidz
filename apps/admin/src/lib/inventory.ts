// Shared by the inventory page (client) and its server actions.

export const ADJUST_REASONS = ["Nhập hàng", "Kiểm kho", "Hàng lỗi", "Khác"] as const;

export const LOW_STOCK = 3; // same threshold as the dashboard's low-stock list (DASHBOARD_DESIGN.md §6.1)

// +5 / −2 / 0 — the sign is part of the meaning (what BigSeller still has to apply).
export function signed(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}
