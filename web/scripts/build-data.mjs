// CSV (data/meikan_freelancers.csv) を読み込み、サイト用の JSON を生成する。
//   data/freelancers.json              一覧表示・検索用の軽量データ (Server Component が読む)
//   public/data/freelancers/{id}.json  モーダルで表示する全項目 (クリック時に取得)
// CSV は Vercel でもビルドできるよう web プロジェクト内に置く。
// スクレイパーで CSV を更新したら `npm run sync-csv` で ../output からコピーする。
// CSV の場所は環境変数 MEIKAN_CSV で変更できる。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const csvPath = process.env.MEIKAN_CSV ?? path.join(webRoot, "data", "meikan_freelancers.csv");
const indexPath = path.join(webRoot, "data", "freelancers.json");
const detailDir = path.join(webRoot, "public", "data", "freelancers");

if (!fs.existsSync(csvPath)) {
  console.error(`CSV が見つかりません: ${csvPath}`);
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const { data: rows, errors } = Papa.parse(csv, { header: true, skipEmptyLines: true });
if (errors.length) {
  console.error("CSV の解析に失敗しました:", errors.slice(0, 5));
  process.exit(1);
}

// 画像未登録のフリーランスは "https://freelance-meikan.com/storage/" だけが入っている。
// また一部は "/storage/storage/" と重複しており 404 になるため補正する。
const avatarOf = (url) =>
  url && /\.(jpe?g|png|gif|webp)$/i.test(url) ? url.replace("/storage/storage/", "/storage/") : null;
const col = (row, key) => (row[key] ?? "").trim();

fs.rmSync(detailDir, { recursive: true, force: true });
fs.mkdirSync(detailDir, { recursive: true });
fs.mkdirSync(path.dirname(indexPath), { recursive: true });

const index = rows.map((row) => {
  const id = String(row["ID"]).replace(/\D/g, "");
  fs.writeFileSync(path.join(detailDir, `${id}.json`), JSON.stringify(row));

  return {
    id,
    name: col(row, "氏名") || "（氏名未登録）",
    avatar: avatarOf(col(row, "アバター画像URL")),
    status: col(row, "現在の対応状況"),
    jobCategory: col(row, "職種").split(" / ")[0] || "その他",
    jobTypes: col(row, "職種"),
    occupation: col(row, "職業(AI)"),
    expertise: col(row, "専門性レベル(AI)"),
    company: col(row, "会社名(AI)"),
    hasCompanyUrl: Boolean(col(row, "会社リンク(AI)")),
    prefecture: col(row, "在住都道府県"),
    catchphrase: col(row, "キャッチコピー"),
    hourlyRate: col(row, "希望時給単価"),
    hasEmail: Boolean(col(row, "メールアドレス")),
    hasPhone: Boolean(col(row, "電話番号")),
    searchText: [
      "氏名", "キャッチコピー", "職種", "スキル", "職業(AI)", "現在の仕事内容(AI)", "経歴(AI)",
      "会社名(AI)", "在住都道府県",
    ].map((key) => col(row, key)).join(" ").toLowerCase(),
  };
});

fs.writeFileSync(indexPath, JSON.stringify(index));
console.log(`データ生成: ${index.length}件 (${path.relative(webRoot, csvPath)})`);
