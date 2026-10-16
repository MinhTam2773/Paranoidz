import { createHmac } from "node:crypto";

// SPX Open API request signature (spx.vn/integration → API authentication guide): hex
// HMAC-SHA256 keyed with the app-secret over "<app-id>_<timestamp>_<random-num>_<body>".
// `body` must be the exact string that is sent; timestamp in seconds; random-num is an int64.
export function checkSign(appId: number, appSecret: string, timestamp: number, random: bigint, body: string) {
  return createHmac("sha256", appSecret).update(`${appId}_${timestamp}_${random}_${body}`).digest("hex");
}
