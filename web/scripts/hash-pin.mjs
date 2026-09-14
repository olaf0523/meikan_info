// ロック画面の PIN を変更するための値を生成する。
//   使い方: npm run hash-pin -- <数字のPIN>
// 出力された LOCK_SALT / LOCK_VERIFIER を環境変数 (Vercel の Environment Variables) に設定し、
// PIN の桁数が 15 桁以外なら NEXT_PUBLIC_PIN_LENGTH も設定して再デプロイする。
// PIN 自体はどこにも保存されない。

import { webcrypto } from "node:crypto";

const pin = process.argv[2] ?? "";
if (!/^\d{4,64}$/.test(pin)) {
  console.error("使い方: npm run hash-pin -- <4〜64桁の数字>");
  process.exit(1);
}

const encoder = new TextEncoder();
const salt = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64url");
const key = await webcrypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
const bits = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 210_000 },
  key,
  256,
);
const verifier = Buffer.from(await webcrypto.subtle.digest("SHA-256", bits)).toString("hex");

console.log(`LOCK_SALT=${salt}`);
console.log(`LOCK_VERIFIER=${verifier}`);
console.log(`NEXT_PUBLIC_PIN_LENGTH=${pin.length}`);
