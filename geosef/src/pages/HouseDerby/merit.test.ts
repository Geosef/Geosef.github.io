import { describe, expect, it } from 'vitest';
import { accolades, place, topFirsts, type MeritResult } from './merit';

// Made-up players shaped like the real exports.
const row = (event: string, tournament: string, position: string, points: number): MeritResult =>
  ({ event, tournament, date: '2026-01-01', position, points });
const merit = (results: MeritResult[]) => ({ points: results.reduce((n, r) => n + r.points, 0), events: 0, results });

describe('accolades', () => {
  it('takes the final over the qualifying round, and treats 5-point flight places as participation', () => {
    const a = accolades(merit([
      row('Spring Fling 2026', 'Shootout', '4', 70),
      row('Spring Fling 2026', 'Best Ball Shamble', '1', 25),
      row('Barrel Run 2026', 'Barrel Run Champ [Low Net]', 'T12', 19.25),
      row('Barrel Run 2026', 'Participation', '-', 5),
      row('Summer League Playoffs 2026', 'Cumulative Net Score (including starting +/-)', 'CUT', 15),
      row('The Crown 2026', 'Qualified', 'Round of 128', 7),
      row('Fall Ball 2025', 'Fall Ball Matches', '2', 5),
      row('Lionshare 2026', 'Lionshare', '3', 5),
      row('Summer League 2026', 'Participation - May', '-', 5),
      row('Summer League 2026', 'Participation - June', '-', 5),
      row('Captain\'s Cup 2026', 'Captain\'s Cup', 'T41', 5),
    ]));
    expect(a.finishes).toEqual([
      { event: 'Spring Fling', label: '4th', place: 4 },
      { event: 'Barrel Run', label: 'T12', place: 12 },
    ]);
    expect(a.qualifiers).toEqual([
      { event: 'Summer League Playoffs', label: 'Qualified' },
      { event: 'The Crown', label: 'Qualified' },
    ]);
    expect(a.participation).toEqual(expect.arrayContaining([
      { event: 'Summer League', times: 2 },
      { event: 'Fall Ball', times: 1 },
      { event: 'Lionshare', times: 1 },
      { event: 'Captain\'s Cup', times: 1 },
    ]));
  });

  it('ranks by place, not points, with brackets mapped to places and divisions named', () => {
    const a = accolades(merit([
      row('The Crown 2026', 'The Crown 2026 - Championship - Finals', 'Runner Up', 160),
      row('Spring Fling 2026', 'Shootout', '1', 135),
      row('Summer League Playoffs 2026', 'Cumulative Net Score (including starting +/-)', '2', 130),
      row('Club Championship 2026', 'Club Championship - Gross Division', 'T4', 87.5),
      row('Captain\'s Cup 2026', 'Captain\'s Cup', 'T15', 16.5),
      row('Camp Gimme 008 Indy', 'Camper', '-', 10),
      row('Barrel Run 2026', 'Participation', '-', 5),
      row('Barrel Run 2026', 'Barrel Run Champ [Low Net]', 'T53', 5),
    ]));
    expect(a.finishes.map(f => `${f.label} ${f.event}`)).toEqual([
      '1st Spring Fling', 'Runner-up The Crown', '2nd Summer League Playoffs', 'T4 Club Championship (Gross)', 'T15 Captain\'s Cup',
    ]);
    // Two rows for one event (not monthly) is still one event.
    expect(a.participation).toEqual([{ event: 'Camp Gimme 008 Indy', times: 1 }, { event: 'Barrel Run', times: 1 }]);
  });

  it('keeps deep bracket runs as finishes', () => {
    expect(accolades(merit([row('The Crown 2026', 'The Crown 2026 - Championship - Finals', 'Round of 32', 35)])).finishes)
      .toEqual([{ event: 'The Crown', label: 'Round of 32', place: 17 }]);
  });

  it('is empty without results', () => {
    expect(accolades(undefined)).toEqual({ finishes: [], qualifiers: [], participation: [] });
  });
});

describe('flight events', () => {
  // Three flight winners; only the top payout won the event outright.
  const winner = merit([row('Lionshare 2026', 'Lionshare', '1', 160)]);
  const flightA = merit([row('Lionshare 2026', 'Lionshare', '1', 80)]);
  const flightB = merit([row('Lionshare 2026', 'Lionshare', '1', 65)]);
  const firsts = topFirsts([winner, flightA, flightB]);

  it('keeps the top payout as the 1st', () => {
    expect(accolades(winner, firsts).finishes).toEqual([{ event: 'Lionshare', label: '1st', place: 1 }]);
  });

  it('shows the other flight winners as making the shootout', () => {
    expect(accolades(flightA, firsts)).toMatchObject({ finishes: [], qualifiers: [{ event: 'Lionshare', label: 'Shootout' }] });
  });

  it('leaves a lone 1st alone', () => {
    expect(topFirsts([winner]).size).toBe(0);
  });

  it('a shootout row with no position made the shootout (the name is a payout tier)', () => {
    const a = accolades(merit([
      row('Fall Ball 2025', 'Shootout 5th', '-', 40),
      row('Fall Ball 2025', 'Fall Ball Matches', '1', 15),
      row('Spring Fling 2026', 'Shootout', '-', 50),
      row('Spring Fling 2026', 'Best Ball Shamble', '1', 25),
    ]));
    expect(a.finishes).toEqual([]);
    expect(a.qualifiers).toEqual([{ event: 'Fall Ball', label: 'Shootout' }, { event: 'Spring Fling', label: 'Shootout' }]);
  });
});

describe('place', () => {
  it('maps positions to comparable places', () => {
    expect(['1', 'T4', 'Runner Up', 'Semi Finalist', 'Quarter Finalist', 'Round of 16', '-', 'CUT'].map(place))
      .toEqual([1, 4, 2, 3, 5, 9, null, null]);
  });
});
