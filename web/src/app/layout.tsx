import type { Metadata, Viewport } from "next";
import { Shippori_Mincho } from "next/font/google";
import { UNLOCK_FLAG } from "@/lib/lock-shared";
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
  // PIN で保護された非公開サイトなので検索エンジンに載せない
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#060913",
};

// 解錠直後の読み込みでは、描画前に目印を付けて「光の中から現れる」演出を出す
const unlockRevealScript = `try{if(sessionStorage.getItem(${JSON.stringify(UNLOCK_FLAG)})){document.documentElement.setAttribute("data-unlocked","");sessionStorage.removeItem(${JSON.stringify(UNLOCK_FLAG)})}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${mincho.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans text-ink">
        <script dangerouslySetInnerHTML={{ __html: unlockRevealScript }} />
        <div aria-hidden className="site-bg" />
        {children}
        <div aria-hidden className="unlock-reveal" />
      </body>
    </html>
  );
}
