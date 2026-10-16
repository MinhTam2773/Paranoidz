import Link from "next/link";
import { ExportFlow } from "@/components/inventory/ExportFlow";
import { formatDateTime } from "@/lib/format";
import { signed } from "@/lib/inventory";
import { loadExport, type ExportOrder } from "./actions";

const card = "flex flex-col gap-3 rounded-sm border border-border bg-surface p-5";
const th = "px-3 py-2 text-left text-th uppercase text-text-secondary";
const td = "border-t border-border px-3 py-2";

export default async function InventoryExportPage() {
  const data = await loadExport(); // requireAdmin inside
  const empty = !data.outLines.length && !data.inLines.length;

  const orderList = (orders: ExportOrder[]) => (
    <ul className="flex flex-col gap-1">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.number}`} className="font-semibold underline">{o.number}</Link>{" "}
          <span className="text-text-secondary">{o.lines.map((l) => `${l.sku ?? "chưa có SKU"} × ${l.qty}`).join(", ")}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/inventory" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Tồn kho</Link>
        <h2 className="text-page-title">Xuất sang BigSeller</h2>
        <p className="text-text-secondary">Gửi cho BigSeller những gì web đã bán hoặc điều chỉnh, để Shopee / TikTok nhận đúng tồn kho.</p>
      </div>

      {empty ? (
        <p className="rounded-sm border border-border bg-surface p-5 text-text-secondary">Không có thay đổi nào chờ gửi BigSeller.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <LinesCard title={`Xuất kho (${data.outLines.length} SKU)`} lines={data.outLines} />
          <LinesCard title={`Nhập kho (${data.inLines.length} SKU)`} lines={data.inLines} />
        </div>
      )}

      {data.outOrders.length > 0 && <section className={card}><h3 className="text-card-title uppercase">Đơn đã tạo vận đơn ({data.outOrders.length})</h3>{orderList(data.outOrders)}</section>}
      {data.backOrders.length > 0 && <section className={card}><h3 className="text-card-title uppercase">Đơn đã gửi rồi bị hủy / giao thất bại ({data.backOrders.length})</h3>{orderList(data.backOrders)}</section>}
      {data.minus.length + data.plus.length > 0 && (
        <section className={card}>
          <h3 className="text-card-title uppercase">Điều chỉnh tồn kho ({data.minus.length + data.plus.length})</h3>
          <ul className="flex flex-col gap-1">
            {[...data.minus, ...data.plus].map((a) => (
              <li key={a.id}><strong>{a.sku}</strong> {signed(a.delta)} <span className="text-text-secondary">· {a.reason ?? "—"} · {formatDateTime(a.createdAt)}</span></li>
            ))}
          </ul>
        </section>
      )}
      {data.blocked.length > 0 && (
        <section className={`${card} border-accent`}>
          <h3 className="text-card-title uppercase text-accent">Chưa gửi được ({data.blocked.length})</h3>
          <p className="text-text-secondary">Có sản phẩm chưa có SKU lúc đặt hàng. Trừ / cộng tay trên BigSeller cho các đơn này.</p>
          {orderList(data.blocked)}
        </section>
      )}
      {data.pendingOrders > 0 && (
        <p className="text-text-secondary">{data.pendingOrders} đơn mới chưa tạo vận đơn: sẽ được xuất sau khi tạo vận đơn (tồn kho web đã trừ sẵn).</p>
      )}

      <ExportFlow empty={empty} />
    </div>
  );
}

function LinesCard({ title, lines }: { title: string; lines: { sku: string; qty: number }[] }) {
  return (
    <section className={card}>
      <h3 className="text-card-title uppercase">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-text-secondary">Không có.</p>
      ) : (
        <table className="w-full">
          <thead><tr><th className={th}>SKU</th><th className={`${th} text-right`}>Số lượng</th></tr></thead>
          <tbody>{lines.map((l) => <tr key={l.sku}><td className={td}>{l.sku}</td><td className={`${td} text-right`}>{l.qty}</td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}
