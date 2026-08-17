# AQUA MOTIF GACHA — Japanese localization handoff

## Purpose
6,000候補化と独立して、既存候補の英名・学名に確実な日本語表示名を追加する。

## Current state
- Candidate pool: 2,304
- Japanese alias file: `data/ja-names.js`
- Verified aliases currently stored: 0
- Built-in Japanese candidate count: first localization task must measure
- UI already supports Japanese primary display + original-name sublabel + Japanese-aware copy

## Canonical separation
- Candidate pool: `window.AQUA_SPECIES` from `data/species-*.js`
- Japanese aliases: `window.AQUA_JA_NAMES` from `data/ja-names.js`

Do not add/remove candidates in the Japanese-localization lane.

## Accuracy rule
- Never invent Japanese names.
- Never map a genus to one representative species' Japanese name.
- Use an established Japanese taxon/common name at the same taxonomic level when confidently supported.
- Leave uncertain names untranslated.

## Parallel workflow
Run `CODEX_JA_TASK.md` in a separate Codex task from the normal `CODEX_TASK.md` expansion task.
The Japanese task should normally touch only:
- `data/ja-names.js`
- `JA_PROGRESS.json`
- `JA_HANDOFF.md`

This minimizes merge conflicts with the 6,000-candidate expansion lane.

## Next action
Measure the current Japanese baseline, then add up to roughly 500 verified Japanese aliases without sacrificing accuracy. Update `JA_PROGRESS.json` with measured values and this handoff with the tests/results.
