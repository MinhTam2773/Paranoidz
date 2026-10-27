import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import localFont from "next/font/local";
import { LoginModal } from "@/components/auth/LoginModal";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MetaPixel } from "@/components/tracking/MetaPixel";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

// Logo wordmark only (DESIGN.md §3). No Vietnamese subset exists; "PARANOIDZ" doesn't need it.
const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: "700",
});

// Brand slogan font (DFVN MBF Space Habitat, Regular) — used for the
// "Back to Basicz" section heading. File supplied by the shop owner;
// self-hosted so the heading renders identically for every visitor.
const basicz = localFont({
  src: "./fonts/DFVNMBFSpaceHabitat.ttf",
  variable: "--font-basicz",
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Paranoidz",
  description: "Paranoidz — thời trang streetwear. Thanh toán COD hoặc chuyển khoản VietQR.",
  openGraph: {
    title: "Paranoidz",
    description: "Paranoidz — thời trang streetwear. Thanh toán COD hoặc chuyển khoản VietQR.",
    url: SITE_URL,
    siteName: "Paranoidz",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${rajdhani.variable} ${basicz.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MetaPixel />
        <AnnouncementBar />
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
        <LoginModal />
      </body>
    </html>
  );
}
