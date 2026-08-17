# AQUA MOTIF GACHA — Japanese localization handoff

## Current state (2026-08-17)
- Candidate pool: 6,000（正規化完全一致の重複 0）
- Built-in Japanese candidates: 604
- Verified aliases: 521
- Localized total: 1,125 / 6,000
- Unlocalized: 4,875
- Source coverage: 521 / 521 (100%)

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

作業前のverified aliasesは35件で、完全走査により486件増加した。全521件の確認元タクソンURLは `data/ja-sources.json` に保存した。

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
- source coverage: 521 / 521 (100%)
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
