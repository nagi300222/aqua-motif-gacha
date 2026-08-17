# AGENTS.md

## Project goal
AQUA MOTIF GACHA is an iPhone Safari / GitHub Pages static app that instantly draws 10 non-mammalian aquatic-animal motifs for original-character drawing.

## Priorities
1. Keep the gacha working on iPhone Safari.
2. Grow the real aquatic-animal name pool to exactly 6,000.
3. In parallel, increase verified Japanese display-name coverage without blocking pool expansion.
4. Speed over encyclopedia metadata: names only are enough.
5. Never invent species names or Japanese names just to reach a quota.

## Data rules
- Canonical runtime candidate array: `window.AQUA_SPECIES` loaded from `data/species-*.js`.
- Japanese display aliases live separately in `window.AQUA_JA_NAMES` from `data/ja-names.js`.
- Preserve existing candidate names unless fixing an actual invalid/duplicate entry.
- New candidates may use a reliable Japanese common name; otherwise use an established English common name or scientific name.
- Japanese aliases must match the same taxonomic level as the source key. Do not map a genus name to one member species just to obtain a Japanese label. For a genus, use an established Japanese genus name such as `〜属` when one is genuinely established; otherwise leave it untranslated.
- Exclude mammals.
- Normalize candidate duplicate checks with NFKC, trim, and case-insensitive comparison.
- Keep normalized exact candidate duplicates at 0.

## Parallel lanes
### Expansion lane
Read `CODEX_TASK.md`, `CHAT_HANDOFF.md`, and `BATCH_PROGRESS.json`. Add `min(1000, 6000-current)` valid candidates, test, then update expansion progress. Do not edit `data/ja-names.js`, `JA_PROGRESS.json`, or `JA_HANDOFF.md` in this lane.

### Japanese-localization lane
Read `CODEX_JA_TASK.md`, `JA_PROGRESS.json`, and `JA_HANDOFF.md`. Add only verified Japanese aliases for existing candidates. Do not add/remove candidates and do not edit `BATCH_PROGRESS.json` or expansion species files. This lane may run concurrently with expansion work.

## App constraints
- Static files only; no backend required.
- 10 unique results per draw.
- When a verified Japanese alias exists, show Japanese prominently and the original scientific/English name below it. Otherwise show the original candidate unchanged.
- Keep copy and previous-result behavior.
- Avoid horizontal scrolling on narrow iPhone viewports.
- Do not add unnecessary dependencies or large refactors.
