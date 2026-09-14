// サーバー専用: PIN の照合と、解錠済みを示す Cookie の検証 (Proxy と Route Handler から使う)
//
// PIN そのものはコードに含めない。PIN から PBKDF2 (SHA-256, 210,000 回) で導出した 32 バイトを
// 「アクセストークン」として Cookie に保存し、そのトークンの SHA-256 (VERIFIER) だけをここに置く。
// VERIFIER からトークンや PIN を逆算することはできず、総当たりには 1 回ごとに PBKDF2 が必要になる。
//
// PIN を変更する場合は `npm run hash-pin -- <新しいPIN>` を実行し、出力された
// LOCK_SALT / LOCK_VERIFIER を環境変数 (Vercel の Environment Variables) に設定する。

export const ACCESS_COOKIE = "meikan_access";

const SALT = process.env.LOCK_SALT || "PK4BELIpqBxRYYT6BU9iTw";
const VERIFIER = process.env.LOCK_VERIFIER || "5cc4df7a6166900cf6fee10c0bfd56b9a3299515ac2b772244fe1fa4da97a0a2";
const ITERATIONS = 210_000;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "===".slice((base64.length + 3) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 長さが同じ文字列を、比較時間から内容が推測されないように比較する */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Cookie のアクセストークンが正しいか (Proxy で毎リクエスト実行するため軽量) */
export async function isValidAccessToken(token: string | undefined) {
  if (!token) return false;
  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length !== 32) return false;
  return safeEqual(await sha256Hex(bytes), VERIFIER);
}

/** PIN が正しければアクセストークンを返す */
export async function createAccessToken(pin: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(SALT), iterations: ITERATIONS },
    key,
    256,
  );
  const token = toBase64Url(new Uint8Array(bits));
  return (await isValidAccessToken(token)) ? token : null;
}
