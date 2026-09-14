import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/lock";

/** 再びロックする (解錠 Cookie を削除) */
export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
