# AGENTS.md

## Project goal
AQUA MOTIF GACHA is an iPhone Safari / GitHub Pages static app that instantly draws 10 non-mammalian aquatic-animal motifs for original-character drawing.

## Priorities
1. Keep the gacha working on iPhone Safari.
2. Grow the real aquatic-animal name pool to exactly 6,000.
3. Speed over encyclopedia metadata: names only are enough.
4. Never invent species names just to reach the target.

## Data rules
- Canonical runtime array: `window.AQUA_SPECIES` loaded from `data/species-*.js`.
- Preserve existing names unless fixing an actual invalid/duplicate entry.
- New entries may use a reliable Japanese common name; otherwise use an established English common name or scientific name.
- Exclude mammals.
- Normalize duplicate checks with NFKC, trim, and case-insensitive comparison.
- Keep normalized exact duplicates at 0.

## Batch workflow
For a normal expansion task, read `CODEX_TASK.md`, `CHAT_HANDOFF.md`, and `BATCH_PROGRESS.json`. Add `min(1000, 6000-current)` valid names, test, then update the progress and handoff files. Never exceed 6,000.

## App constraints
- Static files only; no backend required.
- 10 unique results per draw.
- Keep copy and previous-result behavior.
- Avoid horizontal scrolling on narrow iPhone viewports.
- Do not add unnecessary dependencies or large refactors.
