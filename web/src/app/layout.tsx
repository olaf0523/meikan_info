import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "フリーランス名鑑 データベース",
  description: "フリーランス名鑑に掲載されている全フリーランスの一覧とAI分析結果",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
