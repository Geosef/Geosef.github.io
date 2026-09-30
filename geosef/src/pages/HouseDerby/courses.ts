// The two courses the Derby is played on, for the course pages. Scorecards
// are public and fixed, so they live here rather than in Firestore.

export interface Hole { hole: number; par: number; yards: number; si: number }
export interface Course {
  id: string;
  name: string;
  location: string;
  /** How it's played, when that's not simply on site. */
  playedAt?: string;
  tees: string;
  rating?: number;
  slope?: number;
  about: string;
  holes: Hole[];
}

const card = (par: number[], yards: number[], si: number[]): Hole[] =>
  par.map((p, i) => ({ hole: i + 1, par: p, yards: yards[i], si: si[i] }));

export const COURSES: Course[] = [
  {
    id: 'adare-manor',
    name: 'Adare Manor',
    location: 'Adare, County Limerick, Ireland',
    playedAt: 'Played on Trackman at Gimme Golf Club, St. Charles',
    tees: 'White',
    about: 'The parkland championship course on the River Maigue, host of the 2027 Ryder Cup. Friday\'s alt-shot is played on it in the simulator bays.',
    holes: card(
      [4, 4, 4, 3, 4, 3, 5, 4, 5, 4, 3, 5, 4, 4, 4, 3, 4, 5],
      [376, 398, 392, 155, 372, 183, 501, 412, 568, 375, 151, 492, 403, 377, 277, 155, 393, 525],
      [11, 5, 3, 15, 17, 7, 13, 9, 1, 8, 14, 16, 4, 12, 18, 6, 10, 2],
    ),
  },
  {
    id: 'ballwin',
    name: 'Ballwin Golf Course',
    location: 'Ballwin, Missouri',
    tees: 'Blue',
    rating: 34.6,
    slope: 116,
    about: 'A nine-hole course in Ballwin. Saturday\'s scramble, modified alt and singles are all played here.',
    holes: card(
      [4, 5, 4, 3, 4, 5, 4, 4, 3],
      [389, 459, 353, 173, 369, 496, 423, 347, 200],
      [5, 2, 8, 9, 4, 3, 6, 1, 7],
    ),
  },
];

export const courseById = (id?: string) => COURSES.find(c => c.id === id);

export const totals = (holes: Hole[]) => ({
  par: holes.reduce((n, h) => n + h.par, 0),
  yards: holes.reduce((n, h) => n + h.yards, 0),
});
