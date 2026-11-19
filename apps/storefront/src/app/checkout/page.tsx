import type { Metadata } from "next";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { CheckoutView, type CheckoutAccount } from "@/components/checkout/CheckoutView";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "Thanh toán | Paranoidz", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Buy It Now arrives as ?variant=<id>&qty=<n> and skips the cart (ARCHITECTURE.md §4);
// otherwise the order is the cart. Malformed params fall back to the cart.
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const { variant, qty } = await searchParams;
  const n = Number(qty);
  const buyNow =
    typeof variant === "string" && UUID.test(variant) && Number.isInteger(n) && n >= 1 && n <= 20
      ? { variantId: variant, qty: n }
      : null;

  // Signed in: pre-fill from the default (else newest) saved address, the profile and the email.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  let account: CheckoutAccount = null;
  if (claims) {
    const [{ data: profile }, { data: addresses }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", claims.claims.sub).maybeSingle(),
      supabase
        .from("addresses")
        .select("id, name, phone, address, ward, city, is_default")
        .eq("user_id", claims.claims.sub)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    account = {
      name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      email: claims.claims.email ?? "",
      addresses: (addresses ?? []).map((a) => ({
        id: a.id, name: a.name, phone: a.phone, address: a.address, ward: a.ward ?? "", city: a.city, isDefault: a.is_default,
      })),
    };
  }

  // Free shipping campaign running now (admin, Mã giảm giá): shown under the totals.
  // The charge itself comes from quote_order() / place_order() (ships_free()).
  const now = new Date().toISOString();
  const { data: campaign } = await createAdminClient()
    .from("free_ship_campaign").select("ends_at").lte("starts_at", now).gt("ends_at", now).maybeSingle();
  // "30/11, 23:59" (en-GB, fixed shape) → "23:59 ngày 30/11"
  const [endDay, endTime] = campaign
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" })
        .format(new Date(campaign.ends_at)).split(", ")
    : [];
  const freeShipUntil = campaign ? `${endTime} ngày ${endDay}` : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Giỏ hàng", href: "/cart" }, { label: "Thanh toán" }]} />
      <h1 className="mb-6 text-h2 uppercase">Thanh toán</h1>
      <CheckoutView buyNow={buyNow} account={account} freeShipUntil={freeShipUntil} />
    </div>
  );
}
