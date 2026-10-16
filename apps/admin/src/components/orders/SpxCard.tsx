import { createAdminClient } from "@paranoidz/db/admin";
import { PROVINCES } from "@paranoidz/db/provinces";
import { formatDateTime, formatVnd } from "@/lib/format";
import type { OrderStatus } from "@/lib/order-status";
import { spxUserCall } from "@paranoidz/db/spx";
import { matchWard } from "@paranoidz/db/spx/order-body";
import { SpxCreateForm, SpxLabelButton } from "./SpxActions";

type Order = {
  id: string;
  status: OrderStatus;
  city: string;
  ward: string | null;
  shipping_fee: number;
  spx_tracking_no: string | null;
  spx_ward: string | null;
  spx_fee: number | null;
  spx_created_at: string | null;
};

// Body of the "Vận chuyển SPX" card (DASHBOARD_DESIGN.md §6.2). Rendered under <Suspense>:
// an order without a shipment waits for SPX's pickup slots. Creating the shipment confirms it.
export async function SpxCard({ order }: { order: Order }) {
  if (order.spx_tracking_no) {
    return (
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-3">
          <Row label="Mã vận đơn">
            <a href={`https://spx.vn/track?${order.spx_tracking_no}`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 hover:text-accent">
              {order.spx_tracking_no}
            </a>
          </Row>
          <Row label="Phường / xã">{order.spx_ward}</Row>
          <Row label="Phí SPX">{order.spx_fee === null ? "—" : formatVnd(order.spx_fee)}</Row>
          <Row label="Phí đã thu">{formatVnd(order.shipping_fee)}</Row>
          {order.spx_created_at && <Row label="Tạo lúc">{formatDateTime(order.spx_created_at)}</Row>}
        </dl>
        {(order.status === "pending" || order.status === "confirmed" || order.status === "shipped") && <SpxLabelButton orderId={order.id} />}
      </div>
    );
  }

  const province = PROVINCES.find((p) => p.name === order.city)?.spx ?? "";
  const [{ data: rows, error }, slots] = await Promise.all([
    createAdminClient().from("spx_locations").select("ward").eq("province", province),
    pickupSlots(),
  ]);
  if (error) throw error;
  if (!slots?.length) return <p className="text-accent">Không tải được giờ lấy hàng từ SPX. Tải lại trang để thử lại.</p>;

  const wards = rows.map((r) => r.ward).sort((a, b) => a.localeCompare(b, "vi"));
  return <SpxCreateForm orderId={order.id} wards={wards} defaultWard={matchWard(order.ward, wards)} typedWard={order.ward} slots={slots} />;
}

export async function pickupSlots() {
  type Day = { date: string; pickup_time: number; slots: { pickup_time_range_id: number; pickup_time_range: string }[] };
  try {
    const days = await spxUserCall<Day[]>("v1/order/get_pickup_time", { service_type: 1 });
    // SPX lists about six months of days; the next three are enough to choose from.
    return days.slice(0, 3).flatMap((d) =>
      d.slots.map((s) => ({ value: `${d.pickup_time}:${s.pickup_time_range_id}`, label: `${d.date.replaceAll("-", "/")} · ${s.pickup_time_range}` })),
    );
  } catch {
    return null;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right wrap-break-word">{children}</dd>
    </div>
  );
}
