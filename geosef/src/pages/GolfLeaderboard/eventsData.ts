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
//   • points       — which leaderboard column carries this event's points. The
//                    scorer list itself is NOT hand-maintained: the page reads
//                    the season leaderboard and lists everyone with points in
//                    that column. Until the sheet has any, it shows a
//                    "coming soon" note. Omit it entirely for an event that
//                    isn't scoring this season — the section disappears.
// ─────────────────────────────────────────────────────────────────────────────

import type { MonthlyBreakdown } from '../../types/golf';

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

export interface EventPoints {
  /** Leaderboard column this event's points land in. */
  key: keyof MonthlyBreakdown;
  /** Season shown in the section heading. */
  year: number;
  /** Free text under the heading, e.g. "St. Peters · June 27". */
  played?: string;
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
  points?: EventPoints;
}

export const GOLF_EVENTS: Record<string, GolfEvent> = {
  'barrel-run': {
    slug: 'barrel-run',
    name: 'The Barrel Run',
    tagline: 'Battle for the barrel',
    logo: '/golf/ggc-barrel-run.jpg',
    history: [
      'Our first major of the season. The Barrel Run is a battle for bragging rights, a place on the club walls, and a caddie bib in Looper’s for the year.',
    ],
    venue: { name: 'St. Peters Golf Course', courseName: 'St. Peters' },
    when: 'Postponed · not contested this season',
    what: '18-hole net stroke play · 70% handicap',
    pastWinners: [
      { year: 2025, champion: 'Brad Bishop' },
      { year: 2024, champion: 'Kevin Dickherber' },
      { year: 2023, champion: 'Keith Skaggs' },
    ],
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
    when: 'July 27 · 8:30 AM start',
    what: '18-hole individual stroke play · 85% handicap',
    captains: [
      'Adam Rockey',
      'Barry Martin',
      'Brendan Dolan',
      'Brian Schroeder',
      'Colby White',
      'Daniel Stretch',
      'David Lemon',
      'Jack Bedtke',
      'Jacob Kirtley',
      'Jason Thompson',
      'Joey Julius',
      'Josh Klaus',
      'Kenneth Duneman',
      'Kory Goodson',
      'Mark Jones',
      'Mark Schulte',
      'Rob Santo Paulo',
    ],
    pastWinners: [
      { year: 2026, champion: 'Kenneth Duneman' },
      { year: 2025, champion: 'Mark Schulte' },
      { year: 2024, champion: 'Mark Schulte' },
      { year: 2023, champion: 'Colby White' },
    ],
    points: { key: 'captainsCup', year: 2026, played: 'Glen Echo · July 27' },
  },
};

export function getEvent(slug: string | undefined): GolfEvent | undefined {
  return slug ? GOLF_EVENTS[slug] : undefined;
}
