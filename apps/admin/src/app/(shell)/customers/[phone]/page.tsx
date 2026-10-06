import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { BlacklistToggle } from "@/components/customers/BlacklistToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone, formatVnd } from "@/lib/format";

const LOYALTY_EVERY = 10; // ARCHITECTURE.md §5: a gift at every 10 delivered orders
const card = "rounded-sm border border-border bg-surface p-5";
const cardTitle = "mb-4 text-card-title uppercase";

// DASHBOARD_DESIGN.md §6.4 detail. Everything keys on the phone (ARCHITECTURE.md §2.4).
export default async function CustomerPage({ params }: PageProps<"/customers/[phone]">) {
  await requireAdmin();
  const { phone } = await params;
  if (!/^0\d{9}$/.test(phone)) notFound();
  const admin = createAdminClient();

  const [{ data: customer }, { data: orders }, { data: awards }, { data: account }] = await Promise.all([
    admin.from("customers").select("phone, delivered_count, refusal_count, is_blacklisted, created_at").eq("phone", phone).maybeSingle(),
    admin.from("orders").select("id, order_number, recipient_name, email, total, status, created_at").eq("phone", phone).order("created_at", { ascending: false }),
    admin.from("loyalty_awards").select("id, milestone, status, created_at, loyalty_gifts(name)").eq("phone", phone).order("milestone"),
    admin.from("profiles").select("id, full_name, created_at, addresses(id, name, address, ward, district, city, is_default)").eq("phone", phone).maybeSingle(),
  ]);
  if (!customer) notFound();

  const accountEmail = account ? (await admin.auth.admin.getUserById(account.id)).data.user?.email : null;
  const names = [...new Set((orders ?? []).map((o) => o.recipient_name))];
  const name = names[0] ?? account?.full_name ?? formatPhone(phone);
  const emails = [...new Set((orders ?? []).flatMap((o) => (o.email ? [o.email] : [])))];
  const collected = (orders ?? []).filter((o) => o.status === "delivered").reduce((n, o) => n + o.total, 0);
  const towardNext = customer.delivered_count % LOYALTY_EVERY;
  const pendingAwards = (awards ?? []).filter((a) => a.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/customers" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Khách hàng</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-page-title wrap-break-word">{name}</h2>
          {customer.is_blacklisted && (
            <span className="rounded-sm bg-accent px-2.5 py-1 text-badge uppercase text-text-on-dark">Danh sách đen</span>
          )}
        </div>
        <p className="text-text-secondary">{formatPhone(phone)} · Khách từ {formatDateTime(customer.created_at).slice(0, 10)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Số đơn", value: String(orders?.length ?? 0) },
          { label: "Đã giao", value: String(customer.delivered_count) },
          { label: "Từ chối nhận", value: String(customer.refusal_count), alert: customer.refusal_count > 0 },
          { label: "Đã thu (COD)", value: formatVnd(collected) },
        ].map((s) => (
          <div key={s.label} className={`${card} flex flex-col gap-2`}>
            <span className="text-stat-label uppercase text-text-secondary">{s.label}</span>
            <span className={`text-stat ${s.alert ? "text-accent" : ""}`}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={card}>
            <h3 className={cardTitle}>Lịch sử đơn hàng</h3>
            {!orders?.length ? (
              <p className="text-text-secondary">Chưa có đơn hàng.</p>
            ) : (
              <ul className="-mx-5 -mb-5">
                {orders.map((o) => (
                  <li key={o.id} className="border-t border-border">
                    <Link
                      href={`/orders/${o.order_number}`}
                      className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-bg-secondary sm:grid-cols-[130px_1fr_120px_150px]"
                    >
                      <span className="font-semibold">{o.order_number}</span>
                      <span className="justify-self-end sm:order-4 sm:justify-self-start"><StatusBadge status={o.status} /></span>
                      <span className="text-text-secondary sm:order-2">{formatDateTime(o.created_at)}</span>
                      <span className="justify-self-end whitespace-nowrap sm:order-3">{formatVnd(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={card}>
            <h3 className={cardTitle}>Thông tin</h3>
            <dl className="grid gap-y-1 sm:grid-cols-[160px_1fr] sm:gap-x-6 sm:gap-y-3">
              <Row label="Tên đã dùng">{names.length ? names.join(", ") : "—"}</Row>
              <Row label="Email đã dùng">{emails.length ? emails.join(", ") : "—"}</Row>
              <Row label="Tài khoản">
                {account ? `${account.full_name || "(chưa đặt tên)"}${accountEmail ? ` · ${accountEmail}` : ""} · tạo ${formatDateTime(account.created_at).slice(0, 10)}` : "Khách vãng lai (không có tài khoản)"}
              </Row>
              {account && (
                <Row label="Địa chỉ đã lưu">
                  {account.addresses.length ? (
                    <ul className="flex flex-col gap-1">
                      {account.addresses.map((a) => (
                        <li key={a.id}>
                          {a.name}: {[a.address, a.ward, a.district, a.city].filter(Boolean).join(", ")}
                          {a.is_default && <span className="text-text-secondary"> (mặc định)</span>}
                        </li>
                      ))}
                    </ul>
                  ) : "—"}
                </Row>
              )}
            </dl>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className={card}>
            <h3 className={cardTitle}>Quà tri ân</h3>
            <p className="mb-2"><span className="text-stat">{towardNext}</span> / {LOYALTY_EVERY} đơn đã giao → quà tiếp theo</p>
            <div className="mb-4 h-2 overflow-hidden rounded-sm bg-bg-tertiary" role="progressbar" aria-valuemin={0} aria-valuemax={LOYALTY_EVERY} aria-valuenow={towardNext} aria-label="Tiến độ đến quà tiếp theo">
              <div className="h-full bg-text-primary" style={{ width: `${(towardNext / LOYALTY_EVERY) * 100}%` }} />
            </div>
            {pendingAwards.length ? (
              <ul className="flex flex-col gap-2">
                {pendingAwards.map((a) => (
                  <li key={a.id} className="rounded-sm bg-bg-secondary p-3">
                    <span className="font-semibold">Mốc {a.milestone} đơn</span> · {a.loyalty_gifts?.name ?? "Chưa có quà (kho quà trống)"}
                    <span className="block text-stat-label text-text-secondary">Chờ trao · {formatDateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-secondary">Không có quà đang chờ trao.</p>
            )}
          </section>

          <section className={card}>
            <h3 className={cardTitle}>Danh sách đen</h3>
            <p className="mb-4 text-text-secondary">
              {customer.is_blacklisted ? "Số này đang bị chặn đặt đơn mới." : "Chặn số này đặt đơn mới, ví dụ sau nhiều lần bom hàng."}
            </p>
            <BlacklistToggle phone={phone} name={name} blacklisted={customer.is_blacklisted} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="mt-3 text-label uppercase text-text-secondary first:mt-0 sm:mt-0">{label}</dt>
      <dd className="wrap-break-word">{children}</dd>
    </>
  );
}
