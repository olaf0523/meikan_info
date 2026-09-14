import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, isValidAccessToken } from "@/lib/lock";

/**
 * PIN で解錠するまで、ページ・データ・画像を返さない。
 * - ページ (/ など) … URL はそのままでロック画面 (/lock) を表示する (共有リンクの条件は解錠後もそのまま)
 * - /data/* (一覧の長文・詳細 JSON)、/_next/image (アバター) … 401
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const unlocked = await isValidAccessToken(request.cookies.get(ACCESS_COOKIE)?.value);

  if (unlocked) {
    if (pathname === "/lock") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/data/") || pathname.startsWith("/_next/image")) {
    return new NextResponse("Locked", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (pathname === "/lock") return NextResponse.next();

  const response = NextResponse.rewrite(new URL("/lock", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // ロック画面自体に必要なもの (JS/CSS・背景画像・解錠 API など) は対象外
  matcher: ["/((?!_next/static|_next/webpack-hmr|__nextjs|api/|bg/|favicon\\.ico).*)"],
};
