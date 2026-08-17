# AQUA MOTIF GACHA — Japanese localization handoff

## Purpose
6,000候補化と独立して、既存候補の英名・学名に確実な日本語表示名を追加する。

## Current state (2026-08-17)
- Candidate pool: 6,000（正規化完全一致の重複 0）
- Built-in Japanese candidates: 604
- Verified aliases: 35
- Localized total: 639 / 6,000
- Unlocalized: 5,361
- Source coverage: 35 / 35 (100%)

## This localization task
- 作業前マッピング: 0
- 新規マッピング: 35
- 修正した既存誤対応: 0（既存マッピングなし）
- 監査元: JAMSTEC BISMaL の各タクソンページ。検索結果のページタイトルとタクソンページで、同一学名と和名の対応を確認した。
- 各確認元URLは `data/ja-sources.json` に記録した。

## Regression audit
既知の誤対応は 0。次の対象は BISMaL の同一種ページで再確認済み。
- `Arothron meleagris` → `ミゾレフグ`
- `Arothron stellatus` → `モヨウフグ`
- `Euprymna berryi` → `ニヨリミミイカ`
- `Gymnothorax kidako` → `ウツボ`
- `Turritopsis dohrnii` → `チチュウカイベニクラゲ`

`Gymnothorax favagineus` と `Carassius auratus` は今回登録せず、未翻訳のまま維持した。前者はBISMaLの完全一致検索が単一タクソンページへ直接解決せず、後者はタクソン範囲の厳密な確認が必要なためである。`Euprymna morsei` と `Enchelycore pardalis` は候補プールに存在しない。

## Audit results
- 候補数・順序・内容: 日本語化の前後で不変（species filesは未変更）
- 全aliasキー: 候補に完全一致
- source coverage: 100%
- 空値、重複キー、候補外キー、日本語文字のない値: 各0
- 既知の誤対応: 0
- JS/JSON構文エラー: 0
- 10連抽選: 10件かつ重複なし
- 日本語あり/なしの表示とコピー: 正常

## Canonical separation
- Candidate pool: `window.AQUA_SPECIES` from `data/species-*.js`
- Japanese aliases: `window.AQUA_JA_NAMES` from `data/ja-names.js`
- Audit sources: `data/ja-sources.json`（UIでは読み込まない）

## Next action
未対応候補から、日本の公的・学術的資料で同一タクソンとの対応を直接確認できたものだけを追加する。属名は確立した日本語属名を同じ分類階級で確認できない限り登録しない。
