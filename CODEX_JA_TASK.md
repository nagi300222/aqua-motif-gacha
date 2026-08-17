# CODEX JAPANESE TASK — Phase 3 remaining 4,831 multi-source scan

最新 `main` から開始してください。`AGENTS.md`、`JA_PROGRESS.json`、`JA_HANDOFF.md`、`data/ja-phase2-status.json`、既存の日本語化スクリプトを先に読み、確認質問なしで最後まで実行してください。過去PR・古いCodexブランチを土台にしないでください。

## 現在地
- 候補総数: 6,000
- 元から日本語: 604
- 検証済みalias: 565
- 日本語対応済み: 1,169 / 6,000
- 未対応: 4,831
- Phase 1 BISMaL: 521 alias
- Phase 2 FishPix: 44 alias追加、4,875件全走査済み

## 今回の目的
FishPixで未解決の **4,831件すべて** を、FishPix以外の日本の公的・学術情報源へ順次照合し、確実に確認できたaliasだけ追加してください。

### 絶対条件
- **1つの情報源を走査しただけで終了しない。**
- 100件、500件、1,000件など途中件数で停止・PR作成しない。
- 各候補について、利用可能な優先ソースを順に試し、次に試せる公的・学術ソースが残っている限り継続する。
- 全4,831件に「どのソースまで試したか」と最終ステータスが確定するまで成果物を確定しない。
- 自動アクセスを拒否するサイトは突破しない。`blocked` 等で記録して次ソースへ進む。
- 長時間処理はキャッシュ保存し、`--resume` 等で再開可能にする。
- 通信エラーはリトライ・バックオフ後、別ソースへ進む。未解消エラーがあれば件数と対象を残す。

## 採用条件
aliasは以下を満たす場合のみ採用。
1. 候補キーの学名と資料中の学名が完全一致、または資料上で明示された同一タクソンのシノニム。
2. 同一ページ/同一レコードに日本語名が明記。
3. 確認元URLを保存可能。
4. 既存aliasと矛盾しない。矛盾時は日本の現行公的・学術資料で解消できる場合のみ修正。

禁止: 機械翻訳、単純カタカナ転写、代表種からの類推、検索スニペットだけで採用、部分一致、Wikipedia/ブログ/通販/まとめだけを根拠、モデル記憶だけで確定。

## Phase 3 情報源優先順位
FishPixはPhase 2済みなので、未解決4,831件に対して次を順に試してください。
1. 国立科学博物館 UODAS / 淡水魚類 / 標本・その他生物DB
2. 国立科学博物館のその他公開DB・標本DB
3. 東京大学など大学博物館・大学研究室・`ac.jp` の学術DB
4. J-STAGE掲載論文・学会誌・査読資料
5. 日本の公立水族館・博物館・研究機関の公式種ページ/DB
6. シノニム確認の補助に限り WoRMS / FishBase 等

## 実装
新規に原則 `scripts/scan-ja-phase3-multisource.js` を追加してください。

要件:
- 候補6,000件、正規化重複0を開始時に検証。
- 既存565 aliasを保持し対象外にする。
- `data/ja-phase2-status.json` を読み、FishPixでverifiedだった44件を再処理しない。
- 未対応4,831件を固定入力集合として扱う。
- 各候補について `attempts` に試したソース名・URL/検索URL・結果を記録。
- `data/ja-phase3-status.json` に4,831件すべての最終ステータスを保存。
- ソース別parserを分離し、想定外HTML/JSONは採用しない。
- concurrency、timeout、retry、指数バックオフ、レート制限配慮、resume対応。
- 既存 `data/ja-names.js` / `data/ja-sources.json` に追記統合し、既存565件を失わない。
- 同一候補を複数ソースで確認した場合は、優先順位の高い日本公的・学術ソースを採用。

最終ステータス例: `verified-new` / `no-record-after-all-sources` / `no-japanese-name` / `name-mismatch` / `source-conflict` / `blocked-all-remaining-sources` / `error`。

## 既知の回帰
必ず維持:
- `Arothron meleagris` → `ミゾレフグ`
- `Arothron stellatus` → `モヨウフグ`
- `Euprymna berryi` → `ニヨリミミイカ`
- `Gymnothorax kidako` → `ウツボ`
- `Turritopsis dohrnii` → `チチュウカイベニクラゲ`
- `Gymnothorax favagineus` は厳密確認できた場合のみ登録。`ニセゴイシウツボ` を無検証採用しない。
- `Carassius auratus` を `ギンブナ` と直接対応させない。
- `Oryzias latipes` はFishPixで地域型表示が競合済み。別の公的資料で種レベルの単一標準和名を厳密確認できない限り登録しない。
- `Amphilophus citrinellus` はFishPixの交雑表示を和名として採用しない。

## 変更可能ファイル
- `data/ja-names.js`
- `data/ja-sources.json`
- `data/ja-phase3-status.json`
- `JA_PROGRESS.json`
- `JA_HANDOFF.md`
- `scripts/scan-ja-phase3-multisource.js`
- 必要なら `scripts/audit-ja-aliases.js`

変更禁止: `data/species-*.js`, `BATCH_PROGRESS.json`, `CHAT_HANDOFF.md`, `index.html`, `app.js`, `CODEX_JA_TASK.md`, 候補6,000件。

## 完了条件
以下を全部満たすまで完了報告・PR作成しない。
- 固定入力4,831件を全件処理。
- 全4,831件に `attempts` と最終ステータスあり。
- 次に試せる指定優先ソースが残っていない、またはアクセス不能理由を記録済み。
- 候補総数6,000、正規化重複0。
- aliasキー候補外0、空値0、重複キー0。
- 全alias source coverage 100%。
- 既知の回帰違反0。
- JS/JSON構文エラー0。
- `node scripts/audit-species.js` 成功。
- `node scripts/audit-ja-aliases.js` 成功。
- 10連抽選正常、日本語aliasあり/なし双方の表示・コピー正常。

`verified-new` が少なくても問題ありません。**4,831件を複数ソースで最後まで調べ切ることが完了条件です。**

完了時は `JA_PROGRESS.json` / `JA_HANDOFF.md` を実数更新し、ソース別採用数、各最終ステータス数、verified alias総数、日本語対応済み総数 / 6,000、未対応数、source coverage、残存エラーを報告。最後にコミットしPR作成まで進めてください。PR作成APIが使えない場合は、ブランチをGitHubに反映しUIからPR化できる状態まで進めてください。
