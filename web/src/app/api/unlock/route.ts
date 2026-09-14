import { NextResponse } from "next/server";
import { ACCESS_COOKIE, createAccessToken } from "@/lib/lock";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === "string" ? body.pin.replace(/\D/g, "").slice(0, 64) : "";
  const token = pin ? await createAccessToken(pin) : null;

  if (!token) {
    // 総当たりを遅らせるため、失敗時は少し待ってから返す
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }

  const response = NextResponse.json({ ok: true }, { headers: noStore });
  // ブラウザを閉じるまで有効 (次回の訪問では再びロック画面から始まる)
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
