# AQUA MOTIF GACHA — Japanese localization handoff

## Current state (2026-08-17)
- Candidate pool: 6,000（正規化完全一致の重複 0）
- Built-in Japanese candidates: 604
- Verified aliases: 565
- Localized total: 1,169 / 6,000
- Unlocalized: 4,831
- Source coverage: 565 / 565 (100%)

## Phase 2 full scan (FishPix)
`scripts/scan-ja-phase2-fishpix.js` で、Phase 1後に未対応だった4,875件を国立科学博物館の魚類写真資料データベース FishPix に対して最後まで走査した。全件の最終ステータスは `data/ja-phase2-status.json` に保存している。

FishPixの学名欄には命名者が含まれるため、検索は部分一致で取得し、結果行の学名が候補と完全一致するか、候補の直後が括弧付き命名者表記である場合だけ採用した。同一学名の全行が単一の日本語名で一致することも必須とした。

最終結果（合計4,875件、通信エラー0件）:
- `verified`: 44
- `no-exact-record`: 3,833
- `not-species-scientific-name`: 996
- `conflicting-japanese-names`: 1
- `non-taxon-japanese-label`: 1

`Oryzias latipes` は地域型の異なる2表示が競合したため不採用。`Amphilophus citrinellus` は同じレコードの日本語表示が交雑個体（`×`を含む両親名）で、候補種そのものの和名ではないため不採用とした。曖昧な2件を含め、確認条件を満たさない4,831件は未翻訳のまま維持した。

## Full-pool automated scan
`scripts/scan-ja-aliases.js` で候補6,000件をすべて処理した。日本語を既に含む604件も `builtin-japanese` として走査結果に明示的に計上し、残る候補はJAMSTEC BISMaLの学名検索へ照会した。

採用条件は次のすべてを満たす場合に限定した。
1. BISMaL検索が検索結果一覧ではなく単一の `/bismal/j/view/<id>` タクソンページへ解決する。
2. タクソンページのタイトルにある日本語名より前の文字列が候補キーと完全一致する。
3. 同じタイトルに日本語文字を含む和名が明示されている。

曖昧一致、部分一致、属から種への推定、代表種からの類推、翻訳、カタカナ転写は行わない。通信エラーが1件でも残る場合、スクリプトは成果物を確定せず失敗する。

実行結果:
- `builtin-japanese`: 604
- `verified`: 521
- `no-exact-record`: 4,669
- `no-japanese-name`: 193
- `name-mismatch`: 13
- `error`: 0
- 合計: 6,000

Phase 1では作業前35件から486件増加した。Phase 2ではさらに44件増加し、全565件の確認元URLを `data/ja-sources.json` に保存した。

## Regression audit
既知の誤対応は 0。
- `Arothron meleagris` → `ミゾレフグ`
- `Arothron stellatus` → `モヨウフグ`
- `Euprymna berryi` → `ニヨリミミイカ`
- `Gymnothorax kidako` → `ウツボ`
- `Turritopsis dohrnii` → `チチュウカイベニクラゲ`

`Gymnothorax favagineus` と `Carassius auratus` はBISMaL完全一致検索が単一タクソンページへ解決しなかったため未登録。`Euprymna morsei` と `Enchelycore pardalis` は候補プールに存在しない。

## Audit results
- 候補数・順序・内容: 不変（species filesは未変更）
- 全aliasキー: 候補に完全一致
- source coverage: 565 / 565 (100%)
- 空値、重複キー、候補外キー、日本語文字のない値: 各0
- 既知の誤対応: 0
- JS/JSON構文エラー: 0
- 10連抽選: 10件かつ重複なし
- 日本語あり/なしの表示とコピー: 正常

## Re-running
ネットワーク中断に備える場合は、監査対象外の一時ファイルを指定して再開できる。

```sh
node scripts/scan-ja-aliases.js --concurrency 16 --resume /tmp/aqua-ja-scan.json
```

通常実行では毎回6,000候補を新規走査し、一時キャッシュは成功時に削除される。

Phase 2は確定済みステータスを再利用し、失敗した通信だけを再試行する。

```sh
node scripts/scan-ja-phase2-fishpix.js --concurrency 12
```
