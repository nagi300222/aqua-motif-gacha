# MOTIF GACHA

Splatoon系オリジナルキャラクターのモチーフを、iPhone Safariで10件ランダム抽選する静的Webアプリ。
アプリ上部で **🐙 水生生物** と **🌸 花** を切り替えて使う。

| カテゴリ | 候補数 | 日本語対応 |
| --- | --- | --- |
| 🐙 水生生物 | **6,000** | 1,169 |
| 🌸 花 | **5,000** | 792 |

- 1回10件、重複なし（カテゴリごとに別プール）
- 「日本語のみ」ONで、日本語名を持つ候補だけから抽選
- 選択カテゴリ・前回結果はカテゴリ別に localStorage 保存
- 説明・分類・タグ・画像は持たず、名前プールのみ
- GitHub Pages向け（`.nojekyll` あり）

## Files
- `index.html` — UI（カテゴリ切替・候補数・日本語のみ）
- `app.js` — 抽選/コピー/カテゴリ切替/前回保存
- `data/species-*.js` — 水生生物候補の正本（6,000）
- `data/ja-names.js`, `data/ja-sources.json` — 水生生物の日本語alias
- `data/flower-species-*.js` — 花候補の正本（5,000）
- `data/flower-ja-names.js`, `data/flower-ja-sources.json` — 花の日本語alias
- `data/flower-provenance.json` — 花データの出典と内訳
- `BATCH_PROGRESS.json` — 水生生物拡張の進捗
- `CHAT_HANDOFF.md` — ChatGPT/Codex引き継ぎ

## 花データの出典
| 用途 | ソース |
| --- | --- |
| 候補（学名・科・目） | iNaturalist Taxonomy（AWS Open Data `inaturalist-open-data/taxa.csv.gz`, CC0） |
| 学名の裏取り | megatrees/plant_20221117 `plant_megatree.tre`（Smith & Brown 2018 / Jin & Qian 2022） |
| 日本語名 | JMdict/EDICT（EDRDG, CC BY-SA 4.0、`jamdict-data` 1.5 経由） |

再生成は `node scripts/build-flower-data.js`。
ダウンロードは `$FLOWER_CACHE`（既定 `$TMPDIR/aqua-motif-gacha-flower-cache`）にキャッシュされ、
中断しても続きから再開する。選抜は固定シードなので同じ入力なら同じ5,000件になる。

## Scripts
```sh
node scripts/audit-species.js      # 水生生物 6,000 の監査
node scripts/audit-ja-aliases.js   # 水生生物の日本語alias監査
node scripts/audit-flowers.js      # 花 5,000 と日本語aliasの監査
node scripts/test-app.js           # index.html + app.js のスモークテスト
```

## Codex
最初に `CHAT_HANDOFF.md` と `BATCH_PROGRESS.json` を読んでから作業すること。
