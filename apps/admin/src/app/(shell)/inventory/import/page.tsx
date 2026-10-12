import Link from "next/link";
import { ImportFlow } from "@/components/inventory/ImportFlow";
import { requireAdmin } from "@/lib/auth";

// Photo downloads from BigSeller run inside the apply action.
export const maxDuration = 60;

export default async function InventoryImportPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/inventory" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Tồn kho</Link>
        <h2 className="text-page-title">Nhập từ BigSeller</h2>
        <p className="text-text-secondary">Đặt tồn kho web theo BigSeller và tạo sản phẩm cho SKU mới. Thay đổi trên web chưa gửi BigSeller được giữ lại.</p>
      </div>
      <ImportFlow />
    </div>
  );
}
