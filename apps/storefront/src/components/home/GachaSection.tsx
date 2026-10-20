"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { claimGachaTask, getGachaState, spinGacha } from "@/app/gacha/actions";
import { useCart } from "@/lib/cart";
import { formatPhone, normalizePhone } from "@/lib/checkout-validation";
import {
  GACHA_PHONE_KEY,
  GACHA_POOL,
  GACHA_PRIZES,
  GACHA_TASKS,
  GACHA_TIERS,
  type GachaPrizeType,
  type GachaSpinResult,
  type GachaState,
  type GachaTaskId,
} from "@/lib/gacha";
import { getRecentIds } from "@/lib/recently-viewed";

// Gacha prize game "Chơi là có quà" (2026-10-20): a CS:GO-style case-opening
// strip. The browser only animates — gacha_spin() on the server draws the
// prize and hands back the result; the strip is then built so the winning
// card lands under the marker. Filler cards use the same weights for looks.

const CARD_W = 92;
const GAP = 8;
const STEP = CARD_W + GAP;
const STRIP_LEN = 38;
const TARGET = 26;
const SPIN_MS = 5550;

const FILLER: [GachaPrizeType, number][] = [
  ["voucher10", 30],
  ["miss", 25],
  ["voucher20", 17],
  ["socks1", 15],
  ["freeship", 7],
  ["socks3", 5.5],
  ["shirt", 0.5],
];

function drawFiller(): GachaPrizeType {
  const total = FILLER.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [t, w] of FILLER) {
    r -= w;
    if (r <= 0) return t;
  }
  return "miss";
}

// The saved phone lives in localStorage; read it the way lib/cart reads its
// store (server snapshot = none) so hydration never disagrees.
const subscribeNoop = () => () => {};
function readSavedPhone(): string | null {
  try {
    const v = window.localStorage.getItem(GACHA_PHONE_KEY);
    return v && normalizePhone(v) ? v : null;
  } catch {
    return null;
  }
}

function PrizeCard({ type, win }: { type: GachaPrizeType; win: boolean }) {
  const prize = GACHA_PRIZES[type];
  const tier = GACHA_TIERS[prize.tier];
  const legendary = prize.tier === "legendary";
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[10px] border border-white/10 ${win && legendary ? "animate-gacha-gold" : ""}`}
      style={{
        width: CARD_W,
        height: 96,
        marginRight: GAP,
        background: "linear-gradient(180deg, #17181f, #101116)",
        color: tier.color,
        ...(win
          ? {
              borderColor: tier.color,
              boxShadow: `0 0 0 2px ${tier.color}, 0 0 28px -2px ${tier.color}`,
              transform: "scale(1.07)",
              zIndex: 3,
            }
          : {}),
      }}
    >
      {legendary && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "radial-gradient(75% 65% at 50% 46%, rgba(245,179,1,.34), transparent 72%)" }}
        />
      )}
      <Image src={prize.img} alt="" width={184} height={184} className="absolute inset-0 h-full w-full object-contain p-[7px]" />
      <div className="absolute inset-x-[9px] bottom-[7px] h-1 rounded-full" style={{ background: tier.color }} />
    </div>
  );
}

export function GachaSection() {
  const cart = useCart();
  const savedPhone = useSyncExternalStore(subscribeNoop, readSavedPhone, () => null);
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const phone = phoneOverride ?? savedPhone;
  const [state, setState] = useState<GachaState | null>(null);
  const [strip, setStrip] = useState<GachaPrizeType[]>(() => [...GACHA_POOL, ...GACHA_POOL].slice(0, 12));
  const [offset, setOffset] = useState(0);
  const [anim, setAnim] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [winIndex, setWinIndex] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [result, setResult] = useState<GachaSpinResult | null>(null);
  const [status, setStatus] = useState("");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [viewedCount, setViewedCount] = useState(() => getRecentIds().length);
  const [claimBusy, setClaimBusy] = useState<GachaTaskId | null>(null);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const refresh = useCallback(async (forPhone: string) => {
    const s = await getGachaState(forPhone);
    if (s) setState(s);
  }, []);

  // Load the player's server state whenever the phone becomes known / changes.
  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    getGachaState(phone).then((s) => {
      if (!cancelled && s) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  useEffect(() => {
    const stash = timers.current;
    return () => stash.forEach((t) => window.clearTimeout(t));
  }, []);

  async function onSpin() {
    if (spinning) return;
    if (!phone) {
      setPhoneOpen(true);
      return;
    }
    setSpinning(true);
    setResult(null);
    setWinIndex(null);
    setStatus("Đang mở...");
    const out = await spinGacha(phone);
    if (!out.ok) {
      setSpinning(false);
      setStatus(out.message);
      void refresh(phone);
      return;
    }
    const prize = out.spin;
    const cards = Array.from({ length: STRIP_LEN }, drawFiller);
    cards[TARGET] = prize.prizeType;
    // Near-miss theatre: park the shirt right after a low prize, sometimes.
    if ((prize.tier === "common" || prize.tier === "rare") && Math.random() < 0.55) cards[TARGET + 1] = "shirt";
    setStrip(cards);
    setAnim(false);
    setOffset(0);
    const vpW = vpRef.current?.clientWidth ?? 0;
    const jitter = Math.floor(Math.random() * 39) - 19;
    const finalX = -(TARGET * STEP + CARD_W / 2 - vpW / 2 + jitter);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim(true);
        setOffset(finalX);
      }),
    );
    timers.current.push(window.setTimeout(() => setStatus("Sắp dừng..."), 4000));
    timers.current.push(
      window.setTimeout(() => {
        setWinIndex(TARGET);
        if (prize.tier === "legendary") setFlash((f) => f + 1);
        setResult(prize);
        setStatus(prize.spinsLeft > 0 ? `Còn ${prize.spinsLeft} lượt nữa.` : "Bấm dấu + làm nhiệm vụ để lấy thêm lượt.");
        setSpinning(false);
        void refresh(phone);
      }, SPIN_MS),
    );
  }

  function submitPhone(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setPhoneError("Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.");
      return;
    }
    try {
      window.localStorage.setItem(GACHA_PHONE_KEY, normalized);
    } catch {
      /* storage unavailable — the number still works for this session */
    }
    setPhoneOverride(normalized);
    setPhoneOpen(false);
    setPhoneError(null);
    void getGachaState(normalized).then((s) => {
      setState(s);
      if (s) setStatus(`Bạn có ${s.spinsLeft} lượt quay. Chúc bạn may mắn!`);
    });
  }

  function openMissions() {
    if (!phone) {
      setPhoneOpen(true);
      return;
    }
    setViewedCount(getRecentIds().length);
    setClaimMsg(null);
    setMissionsOpen(true);
  }

  async function onClaim(task: GachaTaskId) {
    if (!phone || claimBusy) return;
    setClaimBusy(task);
    setClaimMsg(null);
    const r = await claimGachaTask(phone, task);
    setClaimBusy(null);
    if (r.ok) {
      await refresh(phone);
      setClaimMsg("Đã cộng +1 lượt quay.");
    } else {
      setClaimMsg(r.message);
      void refresh(phone);
    }
  }

  function onSocial(task: "like" | "follow") {
    window.open(
      task === "like" ? "https://www.facebook.com/paranoidz.vn" : "https://www.tiktok.com/@paranoidz.vn",
      "_blank",
      "noopener",
    );
    void onClaim(task);
  }

  const spinsLeft = state?.spinsLeft ?? 1;
  const outOfSpins = !!phone && !!state && state.spinsLeft <= 0;
  const resultPrize = result ? GACHA_PRIZES[result.prizeType] : null;
  const resultTier = result ? GACHA_TIERS[result.tier] : null;

  return (
    <section
      aria-label="Chơi là có quà"
      className="relative overflow-hidden py-8 text-text-on-dark lg:py-10"
      style={{ background: "radial-gradient(120% 100% at 50% 0%, #17130a 0%, #0b0c12 55%)" }}
    >
      <h2 className="px-4 text-center text-h2 uppercase">
        Chơi là <span style={{ color: "#f5b301" }}>có quà</span>
      </h2>

      {/* Carousel viewport */}
      <div
        ref={vpRef}
        className="relative mt-5 h-[118px] overflow-hidden border-y border-white/10"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(255,255,255,.03))",
        }}
      >
        <div
          className="flex h-full items-center"
          style={{
            transform: `translateX(${offset}px)`,
            transition: anim ? "transform 5.4s cubic-bezier(.07,.84,.08,1)" : "none",
            willChange: "transform",
          }}
        >
          {strip.map((t, i) => (
            <PrizeCard key={i} type={t} win={winIndex === i} />
          ))}
        </div>
        <div aria-hidden className="absolute inset-y-0 left-0 z-[5] w-[46px]" style={{ background: "linear-gradient(90deg, #0b0c12, transparent)" }} />
        <div aria-hidden className="absolute inset-y-0 right-0 z-[5] w-[46px]" style={{ background: "linear-gradient(-90deg, #0b0c12, transparent)" }} />
        <div aria-hidden className="absolute inset-y-0 left-1/2 z-[4] w-[2px] bg-[#ff4d6d]/55" style={{ marginLeft: -1 }} />
        <div
          aria-hidden
          className={`absolute left-1/2 top-0 z-[6] -translate-x-1/2 ${spinning ? "animate-gacha-marker" : ""}`}
          style={{ width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "11px solid #ff4d6d" }}
        />
        <div
          aria-hidden
          className={`absolute bottom-0 left-1/2 z-[6] -translate-x-1/2 ${spinning ? "animate-gacha-marker" : ""}`}
          style={{ width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "11px solid #ff4d6d" }}
        />
        {flash > 0 && (
          <div
            key={flash}
            aria-hidden
            className="animate-gacha-flash pointer-events-none absolute inset-0 z-[7] opacity-0"
            style={{ background: "radial-gradient(60% 90% at 50% 50%, rgba(245,179,1,.35), transparent 70%)" }}
          />
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pt-4 text-center">
        <button
          type="button"
          onClick={onSpin}
          disabled={spinning || outOfSpins}
          className="rounded-full bg-accent px-10 py-3 text-button uppercase text-text-on-dark shadow-accent transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          {spinning ? "Đang quay..." : outOfSpins ? "Hết lượt" : "Quay ngay"}
        </button>
        <div aria-live="polite" className="mt-2.5 min-h-[18px] text-[13px] text-white/85">
          {status}
        </div>
        <div className="mt-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f1ea] py-[7px] pl-4 pr-[9px] text-[13.5px] font-semibold text-[#191c26]">
            Lượt mở quà còn lại: <b className="text-[15px]">{spinsLeft}</b>
            <button
              type="button"
              onClick={openMissions}
              aria-label="Lấy thêm lượt"
              className="inline-flex h-[25px] w-[25px] items-center justify-center rounded-full bg-[#23265e] text-[17px] font-extrabold leading-none text-white transition-transform hover:scale-110"
            >
              +
            </button>
          </span>
        </div>
        {phone && (
          <p className="mt-2 text-caption text-white/50">
            Đang chơi với số {formatPhone(phone)} ·{" "}
            <button type="button" className="underline" onClick={() => { setPhoneInput(phone); setPhoneOpen(true); }}>
              Đổi số
            </button>
          </p>
        )}
      </div>

      {/* Result */}
      {result && resultPrize && resultTier && (
        <div
          className="animate-gacha-pop mx-4 mt-3 rounded-xl border p-3 text-center sm:mx-auto sm:max-w-[430px]"
          style={{ borderColor: resultTier.color, background: "rgba(20,21,26,.94)", boxShadow: `0 0 30px ${resultTier.color}44` }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.24em]" style={{ color: resultTier.color }}>
            {resultTier.label}
          </div>
          <div className="mt-1 text-[17px] font-extrabold">{resultPrize.name}</div>
          {result.code && (
            <div
              className="mt-2 inline-block rounded-lg border-[1.5px] border-dashed px-3 py-[5px] font-mono text-[13.5px] tracking-[0.08em]"
              style={{ color: resultTier.color, borderColor: resultTier.color }}
            >
              {result.code}
            </div>
          )}
          <div className="mt-2 text-[11.5px] text-white/75">
            {result.code ? "Dán mã khi thanh toán để nhận quà. Mã có hạn 7 ngày." : "Đừng buồn — làm nhiệm vụ lấy thêm lượt nhé."}
          </div>
        </div>
      )}

      {/* Won prizes */}
      {!!state?.prizes.length && (
        <div className="mx-auto mt-3 flex max-w-[560px] flex-wrap justify-center gap-1.5 px-4">
          {state.prizes.slice(0, 8).map((p) => {
            const meta = GACHA_PRIZES[p.prizeType];
            const tier = GACHA_TIERS[p.tier];
            return (
              <span
                key={p.code}
                className={`rounded-full border border-white/20 bg-white/5 px-2.5 py-[5px] text-[11.5px] font-bold ${p.status !== "issued" ? "opacity-55" : ""}`}
              >
                <span style={{ color: tier.color }}>●</span> {meta.short}
                {p.status === "issued" && <span className="font-mono font-normal"> · {p.code}</span>}
                {p.status === "redeemed" && " · Đã dùng"}
                {p.status === "expired" && " · Hết hạn"}
              </span>
            );
          })}
        </div>
      )}

      {/* Phone modal */}
      {phoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPhoneOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nhập số điện thoại"
            className="relative w-full max-w-[350px] rounded-2xl border border-white/15 bg-[#14161c] p-5 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Đóng"
              onClick={() => setPhoneOpen(false)}
              className="absolute right-2.5 top-2.5 flex h-[29px] w-[29px] items-center justify-center rounded-full bg-white/10 text-[13px] font-extrabold"
            >
              ✕
            </button>
            <div className="text-center text-[15.5px] font-extrabold uppercase tracking-wide">Nhập số điện thoại</div>
            <p className="mt-1 text-center text-[12px] text-white/60">
              Nhận 1 lượt quay miễn phí mỗi ngày. Lượt quay và quà của bạn được tính theo số này.
            </p>
            <form onSubmit={submitPhone} className="mt-4 flex flex-col gap-3">
              <input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0901 234 567"
                aria-label="Số điện thoại"
                aria-invalid={!!phoneError}
                className="h-11 w-full rounded-lg border border-white/20 bg-white/10 px-3 text-base text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
              />
              {phoneError && <p className="text-[12px] text-[#ff8a8a]">{phoneError}</p>}
              <button type="submit" className="h-11 rounded-full bg-accent text-button uppercase text-text-on-dark transition-colors hover:bg-accent-hover">
                Bắt đầu quay
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Missions modal */}
      {missionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setMissionsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lấy thêm lượt mở"
            className="relative max-h-[92%] w-full max-w-[350px] overflow-y-auto rounded-2xl border border-white/15 bg-[#14161c] p-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Đóng"
              onClick={() => setMissionsOpen(false)}
              className="absolute right-2.5 top-2.5 flex h-[29px] w-[29px] items-center justify-center rounded-full bg-white/10 text-[13px] font-extrabold"
            >
              ✕
            </button>
            <div className="text-center text-[15.5px] font-extrabold uppercase tracking-wide">Lấy thêm lượt mở</div>
            <p className="mt-1 text-center text-[12px] text-white/60">Làm nhiệm vụ — nhận lượt ngay</p>
            <div>
              {GACHA_TASKS.map((task) => {
                const claimed = state?.tasksToday.includes(task.id) ?? false;
                const ready =
                  task.id === "view3" ? viewedCount >= 3 : task.id === "cart" ? cart.length > 0 : true;
                return (
                  <div key={task.id} className="flex items-center gap-2.5 border-b border-white/10 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-bold">{task.name}</div>
                      <div className="mt-px text-[11.5px] font-bold text-[#f5b301]">+{task.reward} lượt mở</div>
                      {task.id === "view3" && !claimed && <div className="text-[11px] text-white/50">Đã xem {Math.min(viewedCount, 3)}/3 sản phẩm</div>}
                    </div>
                    {claimed ? (
                      <button type="button" disabled className="shrink-0 cursor-default rounded-full bg-white/15 px-3.5 py-2 text-[12.5px] font-extrabold text-white/65">
                        Đã nhận
                      </button>
                    ) : !ready ? (
                      <Link href="/products" className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-extrabold text-text-on-dark">
                        {task.id === "view3" ? "Đi xem" : "Đi chọn"}
                      </Link>
                    ) : task.id === "like" || task.id === "follow" ? (
                      <button
                        type="button"
                        disabled={claimBusy !== null}
                        onClick={() => onSocial(task.id as "like" | "follow")}
                        className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-extrabold text-text-on-dark disabled:opacity-50"
                      >
                        {claimBusy === task.id ? "Đang nhận..." : "Làm ngay"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={claimBusy !== null}
                        onClick={() => void onClaim(task.id)}
                        className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-extrabold text-text-on-dark disabled:opacity-50"
                      >
                        {claimBusy === task.id ? "Đang nhận..." : "Nhận +1"}
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center gap-2.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">Đặt đơn thành công</div>
                  <div className="mt-px text-[11.5px] font-bold text-[#f5b301]">+2 lượt mở</div>
                </div>
                <button type="button" disabled className="shrink-0 cursor-default rounded-full bg-white/15 px-3.5 py-2 text-[12.5px] font-extrabold text-white/65">
                  Khi đặt đơn
                </button>
              </div>
            </div>
            {claimMsg && <p className="mt-1 text-center text-[12px] text-white/80">{claimMsg}</p>}
            <p className="mt-2 text-center text-[11px] leading-relaxed text-white/50">
              Hệ thống tự ghi nhận khi bạn xem sản phẩm / thêm giỏ / đặt đơn. Tối đa +3 lượt nhiệm vụ mỗi ngày.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
