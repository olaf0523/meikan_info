# フリーランス名鑑 データベース

`data/meikan_freelancers.csv` をデータ源に、フリーランスの一覧と詳細モーダルを表示する Next.js サイト。

## ローカル

```bash
npm install
npm run dev      # http://localhost:3000
```

`dev` / `build` の前に `scripts/build-data.mjs` が CSV から次の JSON を生成する (どちらも Git 管理外)。

- `data/freelancers.json` … 一覧・検索用
- `public/data/freelancers/{id}.json` … モーダル用の全項目

## Vercel へのデプロイ

環境変数は不要 (OpenAI キーはスクレイパー側だけで使い、サイトには含まれない)。

### A. GitHub 連携

1. リポジトリを GitHub に push する (リポジトリ直下の `.gitignore` が `.env` を除外していることを確認)
2. Vercel で **Add New → Project** からリポジトリを選ぶ
3. **Root Directory** を `web` にする (リポジトリ直下が `web` ならそのまま)
4. Framework Preset は **Next.js**、Build Command / Output はデフォルトのまま **Deploy**

### B. Vercel CLI

```bash
cd web
npx vercel          # プレビュー
npx vercel --prod   # 本番
```

## データの更新

```bash
# リポジトリ直下でスクレイパーを実行して ../output/meikan_freelancers.csv を更新した後
cd web
npm run sync-csv    # CSV を web/data にコピー
git add data/meikan_freelancers.csv && git commit -m "Update freelancer data" && git push
```

GitHub 連携なら push で自動デプロイされる。CLI の場合は `npx vercel --prod` を再実行する。

## 注意

- アバターは Vercel の画像最適化経由で配信する。変換サイズは `next.config.ts` で 64/128/256px に絞り 30 日キャッシュしているため、1 人あたり最大 3 変換 (約 1,000 人で最大 3,000 変換程度)。
- 公開 URL では連絡先を含む全データが誰でも閲覧できる。社内利用に限る場合は Vercel の Deployment Protection などでアクセスを制限すること。
