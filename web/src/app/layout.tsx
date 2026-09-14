import type { Metadata, Viewport } from "next";
import { Shippori_Mincho } from "next/font/google";
import "./globals.css";

// 名前・見出し・キャッチコピーに使う明朝体
const mincho = Shippori_Mincho({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-mincho",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "フリーランス名鑑 データベース",
  description: "フリーランス名鑑に掲載されている全フリーランスの一覧とAI分析結果",
};

export const viewport: Viewport = {
  themeColor: "#060913",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${mincho.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-ink">
        <div aria-hidden className="site-bg" />
        {children}
      </body>
    </html>
  );
}
