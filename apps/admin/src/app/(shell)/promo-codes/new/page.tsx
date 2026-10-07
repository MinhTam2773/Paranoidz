import Link from "next/link";
import { PromoCodeForm } from "@/components/promo-codes/PromoCodeForm";
import { requireAdmin } from "@/lib/auth";

export default async function NewPromoCodePage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/promo-codes" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Mã giảm giá</Link>
        <h2 className="text-page-title">Mã giảm giá mới</h2>
        <p className="text-text-secondary">Không áp dụng cùng ưu đãi 5 đơn đầu: khách được mức giảm cao hơn trong hai mức.</p>
      </div>
      <PromoCodeForm initial={{ code: "", discountPct: "", capAmount: "", maxUses: "", expiresOn: "", isActive: true }} />
    </div>
  );
}
