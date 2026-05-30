// ─────────────────────────────────────────────────────────────────────────────
// Manually-maintained content for the major-event pages (The Barrel Run, the
// Captain's Cup). These are NOT backed by the scoring spreadsheet — edit this
// file by hand and push to update the live pages.
//
//   • intro        — optional lead-in line (the Captain's Cup invitation).
//   • history      — evergreen paragraphs telling the story of the event.
//   • venue        — Where it's played. Set `courseName` to link to that course's
//                    in-app page, OR `websiteUrl` to link out to their site.
//   • when / what  — the date/format lines shown in the Details block.
//   • captains     — optional roster (used by the Captain's Cup).
//   • pastWinners  — one row per year, most recent first.
//   • latestResult — points scorers from the most recent running. Leave it `null`
//                    between events (the page shows a "coming soon" note), then
//                    fill it in once the event is played. Scorer names link to
//                    league profiles, so spell them exactly as on the leaderboard.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventVenue {
  name: string;
  /** Links to this course's in-app page (must match the course name on the board). */
  courseName?: string;
  /** Links out to an external site instead. Takes precedence over courseName. */
  websiteUrl?: string;
}

export interface EventWinner {
  year: number;
  champion: string;
  /** Optional one-liner: score, margin, etc. */
  note?: string;
}

export interface EventScorer {
  rank: number;
  name: string;
  points: number;
  /** Optional one-liner shown under the name (e.g. "Low net of the day"). */
  note?: string;
}

export interface EventResult {
  year: number;
  /** Free text, e.g. "St. Peters · June 27". */
  played?: string;
  scorers: EventScorer[];
}

export interface GolfEvent {
  /** URL slug: /golf-leaderboard/event/<slug> */
  slug: string;
  name: string;
  /** Short subtitle shown under the title. */
  tagline: string;
  /** Path under /public, e.g. "/golf/ggc-barrel-run.jpg". */
  logo?: string;
  /** Optional lead-in line set apart above the history. */
  intro?: string;
  history: string[];
  venue?: EventVenue;
  when?: string;
  what?: string;
  captains?: string[];
  pastWinners: EventWinner[];
  latestResult: EventResult | null;
}

export const GOLF_EVENTS: Record<string, GolfEvent> = {
  'barrel-run': {
    slug: 'barrel-run',
    name: 'The Barrel Run',
    tagline: 'Best net score takes the barrel',
    logo: '/golf/ggc-barrel-run.jpg',
    history: [
      'An individual 18-hole tournament played at 70% of your handicap.',
      'Low net wins the barrel, takes their place on the trophy and the club walls, and earns a caddie bib in Looper’s with their name on it for the year.',
    ],
    venue: { name: 'St. Peters Golf Course', courseName: 'St. Peters' },
    when: 'June 27 · 1:30 PM shotgun start',
    what: '18-hole net stroke play · 70% handicap',
    pastWinners: [
      { year: 2025, champion: 'Brad Bishop' },
      { year: 2024, champion: 'Kevin Dickherber' },
      { year: 2023, champion: 'Keith Skaggs' },
    ],
    latestResult: null,
  },
  'captains-cup': {
    slug: 'captains-cup',
    name: 'Captain’s Cup',
    tagline: 'Earn your place among the Captains',
    logo: '/golf/ggc-captains-logo.png',
    intro: 'On behalf of the Gimme Golf Club Captains, we’d like to invite you to the Captain’s Cup.',
    history: [
      'Hosted each year by the Captains of the Gimme Golf Club.',
      'Win the Cup and you join them — a Captain’s jacket of your own, and a seat at the Captain’s dinner the night before the tournament, every year.',
    ],
    venue: { name: 'Glen Echo Country Club', websiteUrl: 'https://www.gecc.org' },
    when: 'July 27 · start time & format TBD',
    what: '18-hole net stroke play · 70% handicap',
    captains: [
      'Brian Schroeder',
      'Colby White',
      'David Lemon',
      'Jack Bedtke',
      'Joey Julius',
      'Kory Goodson',
      'Mark Schulte',
      'Rob Santo Paulo',
    ],
    pastWinners: [
      { year: 2025, champion: 'Mark Schulte' },
      { year: 2024, champion: 'Mark Schulte' },
      { year: 2023, champion: 'Colby White' },
    ],
    latestResult: null,
  },
};

export function getEvent(slug: string | undefined): GolfEvent | undefined {
  return slug ? GOLF_EVENTS[slug] : undefined;
}
