Reinos do Dragão v0.99.40 — Exact Character Subtitles v2

This patch was rebuilt against the four exact files supplied from the current branch.

Changes:
- 176 exact English transcripts (8 characters × 22 recorded voice variants).
- One variant is selected once and used for both the .m4a file and the subtitle.
- Subtitles are emitted when the actual voice playback starts (also shown when globally muted for accessibility).
- Muriel provisional mapping:
  victory_01 = The spell held. Mostly.
  victory_02 = The cards said so. I merely read them.
  robbed_01 = You've cursed yourself now.
  robbed_02 = I'll take that back. Later.
  trade_done_01 = The stars approve this exchange.
  trade_done_02 = A fine trade. For one of us.
- "This was never chance." is intentionally not mapped for now.

Apply from C:\Users\plc39\BoardGame:
  git apply --check reinos-do-dragao-v0.99.40-exact-character-subtitles-v2.patch
  git apply reinos-do-dragao-v0.99.40-exact-character-subtitles-v2.patch
  npm run checksums:update
  npm run check
