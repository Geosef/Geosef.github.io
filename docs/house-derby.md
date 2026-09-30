# House Derby scoreboard (`/cup`)

Live scoreboard for a two-team, Ryder Cup–style match-play event (OG House vs South House), Oct 16–17, 2026.

## Format

- 36 points. Every point is a 9-hole match. Ties: OG wins at 18–18; South needs 18½.
- **Fri, indoor, Trackman sims.** Two waves of 3 alt-shot pairings. Each pairing plays 18 holes as two separate points: the front nine (holes 1–9) and the back nine (10–18).
- **Sat, Ballwin Golf Course, a 9-hole course.** Scramble (6 matches), then modified alt (6), then singles (12).
- Stages are played one at a time, in order.
- Marshals record who won each hole. There's no handicap math: stroke holes are set per match by the committee and shown to marshals.

## Views

| Route | What |
|---|---|
| `/cup` | Public board: team header, stage tabs, match rows |
| `/cup/match/:id` | Hole-by-hole grid |
| `/cup?tv` | Full-screen board that follows the screen: landscape broadcast board, or on an upright phone the vertical board edge to edge. The "TV view" button on `/cup` opens it. Keeps the screen awake. |
| `/cup?tv=landscape` | Pins the landscape board (clubhouse screens, 16:9 stream captures) |
| `/cup?tv=vertical` | Pins the 9:16 board with bands kept clear for Instagram Live's overlays |
| `/cup/admin[/:id]` | Marshal entry (Google sign-in). `?demo` shows demo controls |

Touching a full-screen board briefly shows an exit button; unattended screens never show it. The full-screen boards hold on the current stage: the one with live play, else the latest with results.

## Code (`geosef/src/pages/HouseDerby/`)

- `scoring.ts`: pure match-play engine. Covers hole results, match state (N&M, dormie, conceded), and cup totals and clinch.
- `scoreEvents.ts` + `useScoreMoments.ts`: diff live snapshots into holes won, points, lead changes and clinch, which drive the animations. Nothing fires on first load. Bulk rewrites (more than 3 matches changed at once) report only a clinch.
- `data.ts`: Firestore hooks, types and labels.
- `display.ts`: which board a URL and screen shape get, page surfaces, wake lock. `CupSplash` is the crest loading screen, bundled with the site so it also covers the lazy /cup download.
- `Board.tsx`: all three public layouts, sharing one `TeamHeader` and `MatchRow`.
- `Admin.tsx` / `MatchEntry.tsx`: marshal list and entry. Every write is batched with an `edits/` log entry (`writes.ts`).
- `demo.ts` / `DemoPanel.tsx`: demo states plus simulate/auto-play. **Remove before the event.**
- `brand.ts` / `Logo.tsx` / `logos/`: inline SVG logos. The two-tone crest is `crest-color.svg`; the single-color `crest.svg` is kept for the gleam mask. `useCupChrome` sets the tab title, icons and the html/body background (see iOS below).
- Tests: `npm test` (Vitest).

## Backend: Firebase project `house-derby-2026` (personal Google account)

- **Firestore collections:** `teams`, `players`, `sessions`, `matches` (and `matches/{id}/edits`), `config/marshals`, `config/allowances`.
- **Match doc:** `{session, slot, nine?, firstHole, startHole, players{og,south}, strokes{og,south}, holes{"1".."18": {result}}, concededBy}`.
- **Security rules (`firestore.rules`):** public read. Only allowlisted marshals can write, and only to `holes`, `concededBy` and `updated*`. `config/*` is readable only by the rules themselves.
- **Web config:** comes from the `VITE_FIREBASE_*` secrets in CI and `geosef/.env.local` locally.
- **API key:** restricted to geosef.io, the Firebase auth domain and local dev.
- **Auth:** Google popup. Authorized sign-in domains include geosef.io.
- The Firebase CLI is pinned to the personal account in this repo directory only (`firebase login:use`).

## Seeding (`cup-seed/`)

```
SEED_ACCOUNT=<owner gcloud account> node cup-seed/seed.mjs [--reset-scores]
```

- **Committed:** `sessions.json` (layout, venues, format labels).
- **Gitignored:** `roster.local.json`, `marshals.local.json` and `pairings.local.json`. These hold the real names, emails and pairings.
- **Pairings file:** keyed by session (`fri-w1`, `fri-w2`, `sat-am`, `sat-mid`, `sat-pm`), with one entry per slot: `{og: [ids], south: [ids], strokes: {og: [holes], south: [holes]}}`. Friday stroke holes are 1–18, and the seed splits them across the front and back nines.
- **Re-seeding is safe mid-event.** It only writes pairing fields. It deletes matches and sessions that are no longer in `sessions.json`, and prints them first.
- **`--reset-scores`** wipes all holes, concessions and edit logs.

## iOS Safari notes

Safari 26+ ignores `theme-color`. It tints its toolbars and overscroll from the html/body background, plus fixed elements near the edges.

- Each view paints html/body via `useCupChrome`.
- Full-screen boards use `100svh`.
- Pages pad for safe areas, since the site uses `viewport-fit=cover`.
- Don't add fixed strips at the top of `/cup`: on a phone they read as a sticky bar.
- Safari's bars only collapse on scroll, so on a landscape phone the TV board gets 80px of scroll room and stays pinned (`hd-tv-swipe`). The real full-screen option on iPhone is Add to Home Screen. `/cup` swaps in its own manifest (`public/cup/manifest.json`, or `tv.webmanifest` on the TV boards) so the icon opens the board rather than the site root.
- Wake lock needs a tap on iOS. The board retries on every tap and shows a hint until the lock is held.

## Before the event

- [ ] Real pairings and stroke holes in `pairings.local.json`, then seed with `--reset-scores`.
- [ ] Final marshal list in `marshals.local.json`, then seed. Every marshal must sign in with a Google account.
- [ ] Remove the demo panel.
- [ ] Font: Bebas Neue is a stand-in for the club's Liberator. The personal license forbids web use. If the club's commercial license covers this site, swap `--hd-display` and inject a subset woff2 from a CI secret. Never commit the font file.
- [ ] New domain: add it to the Firebase authorized domains and the API key referrers.
- [ ] Freeze merges to `main` on Oct 16–17 (main = prod).
- [ ] Check toolbar tinting on an iOS 27 device.

## Ideas not built

- Slack bot posting points: a Firestore-triggered Cloud Function reusing `scoreEvents`, posting to an incoming webhook. Roughly 150 LOC. Skip `(demo)` writes and dedupe retries.
- Golf Genius import: would write the same `holes` shape.
