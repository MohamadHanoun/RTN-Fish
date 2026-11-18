# RTN Fish — bilingual V3 release notes

## What changed
- Add an independently-curated bilingual catalog at `data/knowledge-v3.json`.
- Keep all 3,786 concepts in the reference catalog: 1,857 Verified and 1,929 Review.
- Attach only narrowly scoped, high-confidence matching aliases to existing answers.
- Prevent edit-distance matching from confusing the Latin spellings `Oman` and `Amman`.
- Leave question selection, hearts, timers, design, and multiplayer logic unchanged.
- Add the catalog regression test `tests/knowledge-v3.js`.

## Important data boundaries
Verified refers to source-supported names/concepts. It does not mean
that the concept is an approved answer to every question.
Review entries, unrestricted dictionary vocabulary and context-dependent
answer-question relations are not automatically enabled.

## Verification
From the `RTN Fish` directory, run `npm test`.
The Render web service is configured to build and start within this directory.

## Deployment
Git branch: `main`. Render service: `rtn-fish`.
The deployment version must be checked in the Render dashboard: a GitHub
commit alone does not prove that the live service has been updated.

## Rollback
If an issue is detected, redeploy a previously verified Git commit using
Render's deployment management tools.
