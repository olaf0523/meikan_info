import type { Metadata } from "next";
import LockScreen from "@/components/lock/LockScreen";
import "./lock.css";

export const metadata: Metadata = {
  title: "ロック中 | フリーランス名鑑 データベース",
  robots: { index: false, follow: false },
};

// 未解錠のアクセスは Proxy によってこのページに差し替えられる (URL はアクセス先のまま)
export default function LockPage() {
  return <LockScreen />;
}
