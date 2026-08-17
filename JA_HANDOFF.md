# AQUA MOTIF GACHA — Japanese localization handoff

## Purpose
6,000候補化と独立して、既存候補の英名・学名に確実な日本語表示名を追加する。

## Current state
- Candidate pool: 2,304
- Japanese alias file: `data/ja-names.js`
- Verified aliases currently stored: 131
- Built-in Japanese candidate count: 604
- Localized total: 735 / 2,304
- Unlocalized candidates: 1,569
- UI already supports Japanese primary display + original-name sublabel + Japanese-aware copy

## Latest batch
- Added 131 aliases for existing species-level scientific-name candidates.
- Candidate files were not edited; the measured pool remained 2,304 before and after localization.
- Every alias key was checked for an exact match in `window.AQUA_SPECIES`.
- Values were limited to established Japanese names whose species-level match was clear; no genus aliases were added in this batch.
- Candidates with unclear, conflicting, or merely transliterated Japanese names were left unlocalized. Representative skips include `Electrophorus voltai`, `Muusoctopus robustus`, `Bathynomus raksasa`, and `Echiniscoides sigismundi`.

## Latest audit
- Candidate count unchanged: pass (2,304 before and after).
- Normalized exact candidate duplicates: pass (0).
- Alias keys absent from the candidate pool: pass (0).
- Empty alias values: pass (0).
- Alias values without Japanese characters: pass (0).
- Duplicate object-literal keys / unintended overwrites: pass (0).
- JavaScript syntax and data loading: pass.
- Ten-draw uniqueness and localized/unlocalized display/copy paths: pass.

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
Continue with confidently documented species aliases and established same-rank genus names. Re-measure the pool first in case the expansion lane has advanced, and keep uncertain candidates untranslated.
