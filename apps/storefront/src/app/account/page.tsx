import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { linkClass } from "@/components/auth/styles";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { OrderHistory } from "@/components/order/OrderHistory";
import { afterLoginPath } from "@/lib/auth";
import { formatPhone } from "@/lib/checkout-validation";

export const metadata: Metadata = { title: "Account | Paranoidz", robots: { index: false } };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", claims.claims.sub).single();
  if (!profile?.phone) redirect(afterLoginPath("/account"));

  // RLS (orders_select_own) already limits this to the user's rows; the filter states the intent.
  const { data: orders, error } = await supabase
    .from("orders")
    .select("order_number, status, created_at, recipient_name, phone, secondary_phone, address, ward, city, note, subtotal, discount, total, order_items(name_snapshot, color_snapshot, size_snapshot, qty, price_snapshot, image_snapshot)")
    .eq("user_id", claims.claims.sub)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const images = supabase.storage.from("product-images");

  const rows = [
    { label: "Name", value: profile.full_name || "—" },
    { label: "Email", value: claims.claims.email || "—" },
    { label: "Phone", value: formatPhone(profile.phone) },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
      <h1 className="mb-6 text-h2 uppercase">Account</h1>
      <div className="flex max-w-md flex-col gap-6">
        <dl className="flex flex-col gap-4 rounded-sm border border-border p-6">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="text-nav uppercase text-text-secondary">{label}</dt>
              <dd className="wrap-break-word">{value}</dd>
            </div>
          ))}
        </dl>
        <Link href="/account/password" className={`flex min-h-11 items-center self-start ${linkClass}`}>Change password</Link>
        <LogoutButton />
      </div>
      <div className="mt-12 max-w-4xl">
        <OrderHistory
          orders={orders.map((o) => ({
            orderNumber: o.order_number,
            status: o.status,
            createdAt: o.created_at,
            recipientName: o.recipient_name,
            phone: o.phone,
            secondaryPhone: o.secondary_phone,
            address: o.address,
            ward: o.ward,
            city: o.city,
            note: o.note,
            subtotal: o.subtotal,
            discount: o.discount,
            total: o.total,
            items: o.order_items.map((i) => ({
              name: i.name_snapshot,
              color: i.color_snapshot,
              size: i.size_snapshot,
              qty: i.qty,
              price: i.price_snapshot,
              imageUrl: i.image_snapshot ? images.getPublicUrl(i.image_snapshot).data.publicUrl : null,
            })),
          }))}
        />
      </div>
    </div>
  );
}
