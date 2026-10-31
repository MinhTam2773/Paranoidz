import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { PromoCodeForm } from "@/components/promo-codes/PromoCodeForm";
import { requireAdmin } from "@/lib/auth";
import { vnDate } from "@/lib/format";

export default async function EditPromoCodePage({ params }: PageProps<"/promo-codes/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();
  const [{ data: v, error }, { count }] = await Promise.all([
    admin
      .from("vouchers")
      .select("id, type, code, discount_pct, cap_amount, max_uses, used_count, is_active, is_listed, expires_at")
      .eq("id", id)
      .in("type", ["promo", "standing"])
      .maybeSingle(),
    // every redemption ever, released ones included: those orders were priced with this code
    admin.from("voucher_uses").select("id", { count: "exact", head: true }).eq("voucher_id", id),
  ]);
  if (error) throw error;
  if (!v) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/promo-codes" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Mã giảm giá</Link>
        <h2 className="text-page-title break-all">{v.code}</h2>
      </div>
      <PromoCodeForm
        orderCount={count ?? 0}
        usedCount={v.used_count}
        initial={{
          id: v.id,
          type: v.type === "standing" ? "standing" : "promo",
          code: v.code,
          discountPct: String(v.discount_pct),
          capAmount: v.cap_amount === null ? "" : String(v.cap_amount),
          maxUses: v.max_uses === null ? "" : String(v.max_uses),
          expiresOn: v.expires_at ? vnDate(v.expires_at) : "",
          isActive: v.is_active,
          isListed: v.is_listed,
        }}
      />
    </div>
  );
}
