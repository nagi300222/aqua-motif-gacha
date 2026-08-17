# AQUA MOTIF GACHA — CHAT / CODEX HANDOFF

## 目的
Splatoon系OCを描くときに、実在する非哺乳類の水生動物モチーフを10件すぐ出すためのiPhone向け静的ガチャ。図鑑精度より速度と候補数を優先。

## 現在地
- 目標: **6,000候補（到達）**
- 作業前: **3,304候補**
- 今回追加: **2,696候補**
- 作業後: **6,000候補**
- 残り: **0候補**
- `data/species-*.js`: 名前だけの正本
- `index.html` + `app.js`: GitHub Pagesで動く最小UI

## 今回の変更
- GBIF Species APIで実在する受理名と確認した具体種の二名法2,696件を追加。
- `data/species-18-21.js` に900件、`data/species-22-25.js` に900件、`data/species-26-29.js` に896件を収録。
- 全種が水生となる Bivalvia（二枚貝類）386件、Ophiuroidea（クモヒトデ類）386件、Echinoidea（ウニ類）386件、Holothuroidea（ナマコ類）386件、Scyphozoa（鉢虫類）386件、Ascidiacea（ホヤ類）386件、Demospongiae（普通海綿類）380件を採用。
- 参照API: `https://api.gbif.org/v1/species/search`（2026-08-17取得）。GBIF taxon keysは順に137、350、221、222、352、356、199。各採用レコードで `taxonomicStatus=ACCEPTED`、`rank=SPECIES`、`kingdom=Animalia` を確認。
- 新規データファイルを `data/ja-names.js` と `app.js` より前に読み込み、日本語表示基盤、コピー、前回結果、iPhone向けUIを維持。

## 監査結果
- 総数6,000、今回追加2,696、空名0。
- NFKC + trim + lowercase正規化重複0。
- `sp.` / `spp.` / `cf.` / `aff.` / `?` の禁止表記0。
- 新規2,696件はすべて具体種の二名法。
- 10連を10,000回実行し、10連内重複0、例外0。
- 全JavaScript構文エラー0。
- ページ初期化、日本語表示ファイル込み抽選、iPhone狭幅で横スクロールが発生しないスタイル制約を確認。

## 次の作業
- 拡張目標6,000件に到達済み。候補追加時は6,000件上限と既存監査を維持する。
- 日本語化は専用レーンで、既存候補に対する検証済みエイリアスのみ継続する。
