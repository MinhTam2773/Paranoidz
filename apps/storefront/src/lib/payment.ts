// Bank transfer (VietQR) details. Public by design: these are shown to customers
// at checkout, so they live in code — not in env secrets.
export const BANK_TRANSFER = {
  bankName: "Techcombank",
  bankBin: "970407",
  accountNumber: "19076210110027",
  accountName: "HO KINH DOANH COOLSHIRTZ",
} as const;

export type PaymentMethod = "cod" | "bank_transfer";

// VietQR image link (img.vietqr.io): BIN-account-template.png with the amount,
// the transfer content (the order number) and the account name as query params.
// The QR can only carry the real order number after the order is placed, so this
// is rendered on the order-confirmation screen, not before submit.
export function vietqrImageUrl(amount: number, addInfo: string): string {
  const query = `amount=${Math.round(amount)}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(BANK_TRANSFER.accountName)}`;
  return `https://img.vietqr.io/image/${BANK_TRANSFER.bankBin}-${BANK_TRANSFER.accountNumber}-compact2.png?${query}`;
}
