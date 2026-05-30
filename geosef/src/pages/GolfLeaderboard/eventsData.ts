// ─────────────────────────────────────────────────────────────────────────────
// Manually-maintained content for the special-event pages (The Open, Captains
// Cup). These are NOT backed by the scoring spreadsheet — edit this file by hand
// and push to update the live pages.
//
//   • history       — evergreen paragraphs telling the story of the event.
//   • format        — optional one-liner describing how the event is played.
//   • pastWinners    — one row per year. Add a new row when an event wraps.
//   • latestResult   — the points scorers from the most recent running. Leave it
//                      `null` between events (the page shows a "results coming
//                      soon" note), then fill it in once the event is played.
//
// The page links player names to their league profile, so spell names exactly as
// they appear on the leaderboard.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventWinner {
  year: number;
  champion: string;
  runnerUp?: string;
  /** Optional one-liner: score, venue, margin of victory, etc. */
  note?: string;
}

export interface EventScorer {
  rank: number;
  name: string;
  points: number;
  /** Optional one-liner shown under the name (e.g. "Low round of the day"). */
  note?: string;
}

export interface EventResult {
  year: number;
  /** Where / when it was played — free text, e.g. "Forest Park · June 14". */
  played?: string;
  scorers: EventScorer[];
}

export interface GolfEvent {
  /** URL slug: /golf-leaderboard/event/<slug> */
  slug: string;
  name: string;
  /** Short subtitle shown under the title. */
  tagline: string;
  history: string[];
  format?: string;
  pastWinners: EventWinner[];
  latestResult: EventResult | null;
}

// NOTE: The copy and winners below are PLACEHOLDERS so the pages render with the
// right shape — replace them with the real history and results.
export const GOLF_EVENTS: Record<string, GolfEvent> = {
  open: {
    slug: 'open',
    name: 'The Open',
    tagline: 'The league’s mid-summer major',
    format: 'Two-round stroke play, best score counts toward the season standings.',
    history: [
      'The Open is the marquee event of the GGC season — a points-heavy major that can swing the season standings in a single weekend.',
      'TODO: Replace this with the real story of The Open: when it started, where it’s played, memorable moments, and what makes it the event everyone circles on the calendar.',
    ],
    pastWinners: [
      // Add a row per year, most recent first.
      { year: 2025, champion: 'TODO Champion Name', runnerUp: 'TODO Runner-up', note: 'TODO: winning score / venue' },
    ],
    // Set to `null` until the event is played, then fill in the scorers.
    latestResult: null,
  },
  'captains-cup': {
    slug: 'captains-cup',
    name: 'Captains Cup',
    tagline: 'Team match play, captain’s picks',
    format: 'Captains draft squads and go head-to-head; points awarded by finish.',
    history: [
      'The Captains Cup pits captain-drafted squads against each other in a late-season showdown for bragging rights and a big points haul.',
      'TODO: Replace this with the real story of the Captains Cup: how the draft works, the rivalries, and the format that makes it special.',
    ],
    pastWinners: [
      { year: 2025, champion: 'TODO Winning Captain', runnerUp: 'TODO Runner-up', note: 'TODO: result detail' },
    ],
    latestResult: null,
  },
};

export function getEvent(slug: string | undefined): GolfEvent | undefined {
  return slug ? GOLF_EVENTS[slug] : undefined;
}
