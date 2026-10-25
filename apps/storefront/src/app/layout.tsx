import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
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
      className={`${inter.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MetaPixel />
        <AnnouncementBar />
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
        <LoginModal />
        {/* Anywear virtual try-on — test install on preview branch only, do not merge to live without approval. */}
        <script src="https://anywear.decart.ai/widget/latest/anywear.js?domain=paranoidz.vn" async />
      </body>
    </html>
  );
}
