# GGC Outdoor League — Sheet Reference

Google Sheet (copy): https://docs.google.com/spreadsheets/d/1PATbhSmfKVcHa3ffxiqicTidGhV0g2JN18NkhCcq5xc

Apps Script deployment: https://script.google.com/macros/s/AKfycbxHVPZsFWav4DBh2KUZaTsQ6KScalYsjQ746KwpMXxHkivPKS9sypfPVA8LoleprVmK/exec

---

## Active Sheets

### Total Points

Season standings. This is the primary source for the leaderboard.

Row 3 = headers, data starts row 4.

| Col | Index | Field                 |
| --- | ----- | --------------------- |
| A   | 0     | Rank (sheet-computed) |
| B   | 1     | Player Name           |
| C   | 2     | April Points          |
| D   | 3     | May Points            |
| E   | 4     | June Points           |
| F   | 5     | The Open (Major)      |
| G   | 6     | July Points           |
| H   | 7     | Captains Cup (Major)  |
| I   | 8     | Adjustment for Top 20 |
| J   | 9     | August Points         |
| K   | 10    | Total Points          |

Notes:

- Col I (Adjustment) is not a scoring event — excluded from event counts
- Majors (The Open, Captains Cup) are entered manually, not from form submissions
- All math lives in the sheet; Code.gs just reads it

---

### April Points / May Points / June Points / July Points / August Points

Per-month standings. All five sheets share the same layout.

Row 4 = first data row (index 3).

| Col | Index | Field                       |
| --- | ----- | --------------------------- |
| A   | 0     | Rank (sheet-computed)       |
| B   | 1     | Player Name                 |
| D   | 3     | +/- from Best 2 Rounds      |
| G   | 6     | Points                      |

Notes:

- If players haven't scored two rounds yet, col D shows "N/A" and col G shows "0"
- `getMonthly` reads col G (index 6) for points and col D (index 3) for +/-

---

### Scoring Log 2026

Raw form submissions. One row per round submitted. Row 1 = headers, data starts row 2.

| Col | Index | Field                  |
| --- | ----- | ---------------------- |
| A   | 0     | Timestamp              |
| B   | 1     | Player                 |
| C   | 2     | Course - Tees          |
| D   | 3     | Front/Back             |
| E   | 4     | Month                  |
| F   | 5     | Day                    |
| G   | 6     | Score (raw)            |
| H   | 7     | Playing Partner        |
| I   | 8     | Date Played            |
| J   | 9     | Playing Handicap       |
| K   | 10    | Net Score              |
| L   | 11    | Course Par             |
| M   | 12    | Plus-Minus (net - par) |
| N   | 13    | Month Played           |
| O   | 14    | Month Logged           |
| P   | 15    | Red Flag               |
| Q   | 16    | Monthly Count          |

Key rules:

- Rows where P = "Flagged" are excluded from scoring
- Players may submit up to 5 rounds/month; only best 2 count
- Monthly Count (col Q) tracks how many rounds a player has logged that month
- Playing Partner (col H) is other league members' names — safe to expose

---

### Handicap Index Log

Wide pivot: rows = players, columns = dates (one per day of the season).

| Col | Field                            |
| --- | -------------------------------- |
| A   | Player Name                      |
| B   | Current handicap index           |
| C+  | Historical daily handicap values |

Notes:

- Row 1 = date headers; player rows start at row 2
- Col B = current handicap. Col C+ = historical values keyed by date header in row 1
- Cap reads at 252 columns (`Math.min(getLastColumn(), 252)`) — never call getDataRange() on this sheet

---

### Playing Handicaps

Wide pivot: rows = players + metadata, columns = course/tee combos (101 columns).

Row 1: Column headers — `"Course - Tees - Front"` / `"Course - Tees - Back"` format
Row 2: Par per column
Row 3: Slope per column
Row 4+: Player handicaps per course

Column header parsing: `split(" - ")` → `[courseName, tees, frontBack?]`

Used by `?action=courses` to build the canonical course variant list (all courses, even those with no rounds played). 9-hole courses (currently just Ballwin) are collapsed to a single entry with no front/back. Never read the full table — cap at 110 columns.

---

### Course Info

Static course metadata. Row 1 = headers, data starts row 2.

| Col | Index | Field        |
| --- | ----- | ------------ |
| A   | 0     | Course Name  |
| B   | 1     | Full Name    |
| C   | 2     | Address      |
| D   | 3     | Phone        |
| E   | 4     | Tee Times URL|
| F   | 5     | Architect    |
| G   | 6     | Year Built   |

Course Name must match exactly the `course` field in Scoring Log. Used by `?action=courseInfo`. Maps link is generated on the frontend from Address (`https://maps.google.com/?q=...`).

---

### League Roster 2026

| Col | Field      | Expose? |
| --- | ---------- | ------- |
| A   | Full Name  | Yes     |
| B   | First Name | Yes     |
| C   | Last Name  | Yes     |
| D   | Phone      | No      |
| E   | Email      | No      |

---

### GHIN Import

Weekly GHIN handicap data import. Source for Handicap Index Log updates.
Not needed for any current API endpoint.

---

### Registration 2026

Raw registration form submissions. Contains email, phone, payment status.
Never expose via API.

---

## Apps Script Endpoints

| Route                                   | Status | Returns                                                                                              |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `?action=leaderboard`                   | Live   | `{ standings: [{ rank, name, points, events, isTied }], lastUpdated }`                               |
| `?action=monthly&month=April`           | Live   | `{ month, standings: [{ rank, name, plusMinus, points, isTied }] }`                                  |
| `?action=scoringLog`                    | Live   | `{ rounds: [{ player, course, tees, frontBack, score, netScore, plusMinus, ... }] }`                 |
| `?action=handicapIndex`                 | Live   | `{ players: [{ player, current, history: [{ date, index }] }] }`                                     |
| `?action=courses`                       | Live   | `{ courses: [{ name, frontBack, par, slope }] }` — canonical list from Playing Handicaps headers     |
| `?action=courseInfo`                    | Live   | `{ courses: [{ name, fullName, address, phone, teeTimesUrl, architect, yearBuilt }] }`               |

## Gotchas

- **No `@OnlyCurrentDoc`** — removing this from macros.gs (now deleted) was required to grant the `spreadsheets` OAuth scope for `openById()`
- **Auth must be granted manually** — after any scope change, run a function in the Apps Script editor to trigger the consent flow before deploying
- **Vite proxy for local dev** — Apps Script blocks `localhost` CORS; `vite.config.ts` proxies `/apps-script-proxy` to the exec URL. Production fetches directly.
- **New deployment required for scope changes** — updating the code file alone isn't enough; must create a new deployment and re-authorize
- **Handicap Index Log column cap** — always limit reads to `Math.min(getLastColumn(), 252)` — hundreds of columns will blow up getDataRange()
