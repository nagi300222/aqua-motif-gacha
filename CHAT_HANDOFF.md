# AQUA MOTIF GACHA — CHAT / CODEX HANDOFF

## 目的
Splatoon系OCを描くときに、実在する非哺乳類の水生動物モチーフを10件すぐ出すためのiPhone向け静的ガチャ。図鑑精度より速度と候補数を優先。

## 現在地
- 目標: 6,000候補
- 作業前: **2,304候補**
- 今回追加: **1,000候補**
- 現在: **3,304候補**
- 残り: **2,696候補**
- `data/species-*.js`: 名前だけの正本
- `index.html` + `app.js`: GitHub Pagesで動く最小UI

## 今回の変更
- GBIF Species APIで `rank=SPECIES`、`status=ACCEPTED` として実在確認した具体種の二名法を `data/species-14-17.js` に1,000件追加。
- 全種が水生となる Cephalopoda（頭足類）、Anthozoa（花虫類）、Asteroidea（ヒトデ類）、Hydrozoa（ヒドロ虫類）から各250件を採用。GBIF taxon keysは順に136、206、214、205。
- 参照API: `https://api.gbif.org/v1/species/search`（2026-08-17取得）。各採用レコードの `taxonomicStatus=ACCEPTED`、`rank=SPECIES`、`kingdom=Animalia` を確認。
- `index.html` で新規データを `data/ja-names.js` と `app.js` より前に読み込むよう更新し、日本語表示レイヤーを維持。

## 監査結果
- 総数3,304、今回追加1,000、空名0。
- NFKC + trim + lowercase正規化重複0。
- `sp.` / `spp.` / `cf.` / `aff.` / `?` の禁止表記0。
- 10連を10,000回実行し、10連内重複0、例外0。
- JavaScript構文エラー0。
- ページ初期化、日本語表示ファイル込み抽選、iPhone狭幅の静的UI制約を確認。

## 次の作業
- 3,304件を実測してから、次の `min(1000, 6000-current)` 件を追加する。
- 同じ必須監査を実行し、進捗ファイルを実数で更新する。
