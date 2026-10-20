"use server";

import { createAdminClient } from "@paranoidz/db/admin";
import { normalizePhone } from "@/lib/checkout-validation";
import { hitRateLimit } from "@/lib/rate-limit";
import type { GachaPrize, GachaSpinResult, GachaState, GachaTaskId } from "@/lib/gacha";

// Gacha prize game (2026-10-20): every rule — the daily free spin, mission
// grants and caps, the weighted draw, the monthly shirt cap, the pity rule —
// is enforced by the gacha_* functions in the database. These actions only
// validate the phone, rate-limit, and translate the result. Nothing about the
// draw is decided or trusted on the client.

const TASK_IDS: GachaTaskId[] = ["view3", "cart", "like", "follow"];

type StateJson = {
  phone: string;
  spins_left: number;
  tasks_today: string[];
  prizes: { code: string; prize_type: GachaPrize["prizeType"]; tier: GachaPrize["tier"]; status: GachaPrize["status"]; expires_at: string; issued_at: string }[];
};

export async function getGachaState(rawPhone: string): Promise<GachaState | null> {
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
  if (!phone) return null;
  const { data, error } = await createAdminClient().rpc("gacha_get_state", { p_phone: phone });
  if (error) {
    console.error("gacha_get_state failed", error);
    return null;
  }
  const s = data as StateJson;
  return {
    phone: s.phone,
    spinsLeft: s.spins_left,
    tasksToday: s.tasks_today.filter((t): t is GachaTaskId => (TASK_IDS as string[]).includes(t)),
    prizes: s.prizes.map((p) => ({
      code: p.code,
      prizeType: p.prize_type,
      tier: p.tier,
      status: p.status,
      expiresAt: p.expires_at,
      issuedAt: p.issued_at,
    })),
  };
}

export type SpinOutcome = { ok: true; spin: GachaSpinResult } | { ok: false; message: string };

export async function spinGacha(rawPhone: string): Promise<SpinOutcome> {
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
  if (!phone) return { ok: false, message: "Số điện thoại chưa hợp lệ." };
  try {
    if (!(await hitRateLimit("gacha", phone, { ip: 60, phone: 30 }))) {
      return { ok: false, message: "Bạn thao tác hơi nhanh — đợi một lát rồi thử lại nhé." };
    }
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return { ok: false, message: "Đã có lỗi xảy ra. Vui lòng thử lại." };
  }
  const { data, error } = await createAdminClient().rpc("gacha_spin", { p_phone: phone });
  if (error) {
    if (error.message.startsWith("NO_SPINS")) {
      return { ok: false, message: "Bạn đã hết lượt quay. Làm nhiệm vụ để lấy thêm lượt nhé." };
    }
    console.error("gacha_spin failed", error);
    return { ok: false, message: "Đã có lỗi xảy ra. Vui lòng thử lại." };
  }
  const s = data as { prize_type: GachaSpinResult["prizeType"]; tier: GachaSpinResult["tier"]; code: string | null; expires_at: string | null; spins_left: number };
  return {
    ok: true,
    spin: { prizeType: s.prize_type, tier: s.tier, code: s.code, expiresAt: s.expires_at, spinsLeft: s.spins_left },
  };
}

export type ClaimOutcome = { ok: true; spinsLeft: number } | { ok: false; message: string };

export async function claimGachaTask(rawPhone: string, task: string): Promise<ClaimOutcome> {
  const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
  if (!phone) return { ok: false, message: "Số điện thoại chưa hợp lệ." };
  if (!(TASK_IDS as string[]).includes(task)) return { ok: false, message: "Nhiệm vụ không hợp lệ." };
  try {
    if (!(await hitRateLimit("gacha", phone, { ip: 60, phone: 30 }))) {
      return { ok: false, message: "Bạn thao tác hơi nhanh — đợi một lát rồi thử lại nhé." };
    }
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return { ok: false, message: "Đã có lỗi xảy ra. Vui lòng thử lại." };
  }
  const { data, error } = await createAdminClient().rpc("gacha_claim_task", { p_phone: phone, p_task: task });
  if (error) {
    if (error.message.startsWith("TASK_ALREADY_CLAIMED")) {
      return { ok: false, message: "Nhiệm vụ này bạn đã nhận hôm nay rồi." };
    }
    if (error.message.startsWith("TASK_CAP")) {
      return { ok: false, message: "Hôm nay bạn đã nhận đủ +3 lượt nhiệm vụ. Mai quay lại nhé." };
    }
    console.error("gacha_claim_task failed", error);
    return { ok: false, message: "Đã có lỗi xảy ra. Vui lòng thử lại." };
  }
  return { ok: true, spinsLeft: (data as { spins_left: number }).spins_left };
}
