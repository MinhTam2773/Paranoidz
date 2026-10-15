import "server-only";
import { randomBytes } from "node:crypto";
import { checkSign } from "./sign.ts";

// SPX Open API client (ARCHITECTURE.md §5 "SPX Open API"). Server-only: the keys never reach a
// browser. Every call is a signed JSON POST; SPX answers HTTP 200 with {ret_code, message, data}
// and ret_code 0 means success — anything else throws SpxError.
export class SpxError extends Error {
  readonly retCode: number;
  constructor(retCode: number, message: string) {
    super(message);
    this.retCode = retCode;
  }
}

const TIMEOUT_MS = 15_000;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function spxCall<T>(path: string, payload: object): Promise<T> {
  const appId = Number(env("SPX_APP_ID"));
  const timestamp = Math.floor(Date.now() / 1000);
  const random = BigInt.asUintN(63, randomBytes(8).readBigUInt64BE()); // non-negative int64
  const body = JSON.stringify(payload); // signed and sent as this exact string
  const res = await fetch(new URL(`open/api/${path}`, env("SPX_API_HOST")), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "app-id": String(appId),
      timestamp: String(timestamp),
      "random-num": String(random),
      "check-sign": checkSign(appId, env("SPX_APP_SECRET"), timestamp, random, body),
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new SpxError(-res.status, `SPX HTTP ${res.status}`);
  const json = (await res.json()) as { ret_code: number; message: string; data: T };
  if (json.ret_code !== 0) throw new SpxError(json.ret_code, json.message);
  return json.data;
}

// Calls made on behalf of the seller account (orders, fees, labels, vouchers).
export function spxUserCall<T>(path: string, payload: object = {}): Promise<T> {
  const userId = Number(env("SPX_USER_ID"));
  if (!Number.isSafeInteger(userId)) throw new Error("SPX_USER_ID is not a safe integer"); // 15 digits today
  return spxCall<T>(path, { user_id: userId, user_secret: env("SPX_USER_SECRET"), ...payload });
}
