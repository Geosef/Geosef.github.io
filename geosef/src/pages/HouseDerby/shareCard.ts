// 9:16 share cards for Instagram Stories, drawn straight onto a canvas so the
// image comes out the same on every phone (DOM screenshot libraries drop web
// fonts and inline SVG on iOS). 1080x1920, with content kept clear of the
// top and bottom bands Stories covers with its own UI.
import {
  TEAM_NAMES, dayAndSession, fmtPoints, formatLabel, matchName, shortStatus, sideName, teeClock, teeDay,
  type Match, type Player, type Session,
} from './data';
import { decided } from './director';
import { LOGO_FILES, type LogoName } from './brand';
import { TEAMS, cupStanding, holeOutcome, matchStates, segments, type TeamId } from './scoring';

export type CardSpec =
  | { kind: 'standings'; sessions: Session[]; matches: Match[] }
  | { kind: 'recap'; session: Session; matches: Match[]; byId: Map<string, Player> }
  | { kind: 'match'; match: Match; session?: Session; matches: Match[]; byId: Map<string, Player> };

const W = 1080;
const H = 1920;
const C = {
  og: '#3f4463', south: '#5e7a66', gold: '#c4935f', goldLight: '#f3d9b8',
  cream: '#f8f6ea', ink: '#2b2d3a', muted: '#6b6a62', line: '#e2dfcf', white: '#ffffff',
};
const TEAM_COLOR: Record<TeamId, string> = { og: C.og, south: C.south };
const DISPLAY = '"Bebas Neue", Oswald, Impact, sans-serif';

/** Draws a card and returns it as a PNG. */
export async function renderCard(spec: CardSpec): Promise<Blob> {
  // The canvas only draws a web font once it's loaded; nothing else asks for it early.
  await document.fonts.load(`100px ${DISPLAY}`);
  const logos = await loadLogos();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);
  if (spec.kind === 'standings') drawStandings(ctx, logos, spec);
  else if (spec.kind === 'recap') drawRecap(ctx, logos, spec);
  else drawMatch(ctx, logos, spec);
  drawFooter(ctx, logos);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the card'))), 'image/png'));
}

/** File name for the shared image. */
export function cardFileName(spec: CardSpec): string {
  if (spec.kind === 'standings') return 'house-derby-standings.png';
  if (spec.kind === 'recap') return `house-derby-${spec.session.id}.png`;
  return `house-derby-${spec.match.id}.png`;
}

type Logos = Record<LogoName, HTMLImageElement>;
type Ctx = CanvasRenderingContext2D;

let logoCache: Promise<Logos> | null = null;

/** The club logos as images: team horseshoes and marks in gold, the crest in its own colors. */
function loadLogos(): Promise<Logos> {
  logoCache ??= Promise.all(
    (Object.keys(LOGO_FILES) as LogoName[]).map(async name => {
      const { svg } = LOGO_FILES[name];
      // Canvas needs an intrinsic size, which the files leave to their viewBox.
      const [, , vw, vh] = (svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100').split(/\s+/).map(Number);
      const sized = svg
        .replace(/currentColor/g, C.gold)
        .replace('<svg ', `<svg width="${vw}" height="${vh}" `);
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
      await img.decode();
      return [name, img] as const;
    }),
  ).then(Object.fromEntries as (e: Array<readonly [LogoName, HTMLImageElement]>) => Logos);
  return logoCache;
}

// ---------- drawing helpers ----------

/** Sets a display font at `size`, shrunk until `text` fits `max` wide. */
function fit(ctx: Ctx, text: string, size: number, max: number): number {
  let s = size;
  do {
    ctx.font = `${s}px ${DISPLAY}`;
    if (ctx.measureText(text).width <= max) break;
    s -= 2;
  } while (s > 12);
  return s;
}

function text(ctx: Ctx, t: string, x: number, y: number, { size, color, align = 'center', max = W - 120, spacing = 0 }: {
  size: number; color: string; align?: CanvasTextAlign; max?: number; spacing?: number;
}) {
  const s = t.toUpperCase();
  // Older Safari lacks canvas letterSpacing; the text just sets tighter there.
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  fit(ctx, s, size, max);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = '0px';
}

function logo(ctx: Ctx, logos: Logos, name: LogoName, cx: number, top: number, height: number) {
  const w = height * LOGO_FILES[name].aspect;
  ctx.drawImage(logos[name], cx - w / 2, top, w, height);
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, r = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Split navy/green block with each team's logo, name and a big number. */
function teamSplit(ctx: Ctx, logos: Logos, top: number, height: number, values: Record<TeamId, string>, sub?: Record<TeamId, string[]>) {
  const half = W / 2;
  for (const [i, t] of TEAMS.entries()) {
    const x0 = i * half;
    const cx = x0 + half / 2;
    ctx.fillStyle = TEAM_COLOR[t];
    ctx.fillRect(x0, top, half, height);
    logo(ctx, logos, t, cx, top + 40, 110);
    text(ctx, TEAM_NAMES[t], cx, top + 215, { size: 58, color: C.white, max: half - 80, spacing: 2 });
    text(ctx, values[t], cx, top + 420, { size: 210, color: C.white, max: half - 60 });
    (sub?.[t] ?? []).forEach((line, j) => text(ctx, line, cx, top + 490 + j * 48, { size: 38, color: C.goldLight, max: half - 60, spacing: 2 }));
  }
}

/** Dark band with a line of status text. */
function band(ctx: Ctx, y: number, label: string, color = C.ink) {
  ctx.fillStyle = color;
  ctx.fillRect(0, y, W, 96);
  text(ctx, label, W / 2, y + 66, { size: 50, color: C.white, spacing: 3 });
}

function drawFooter(ctx: Ctx, logos: Logos) {
  logo(ctx, logos, 'ggc', W / 2, 1560, 90);
  text(ctx, 'Gimme Golf Club', W / 2, 1700, { size: 44, color: C.gold, spacing: 4 });
  text(ctx, `${window.location.host}/cup`, W / 2, 1750, { size: 30, color: C.muted, spacing: 2 });
}

// ---------- cards ----------

/** Where the cup stands: the headline score, a status line and points by stage. */
function drawStandings(ctx: Ctx, logos: Logos, { sessions, matches }: Extract<CardSpec, { kind: 'standings' }>) {
  const standing = cupStanding(matches);
  const top = 200;
  // Team colors run up to the top edge (Stories' own header sits over this band).
  ctx.fillStyle = C.og;
  ctx.fillRect(0, 0, W / 2, top);
  ctx.fillStyle = C.south;
  ctx.fillRect(W / 2, 0, W / 2, top);
  const sub = Object.fromEntries(TEAMS.map(t => [t, standing.clinched
    ? [standing.clinched === t ? 'Derby winners' : '']
    : [`${fmtPoints(standing.needed[t])} to win`, `Proj ${fmtPoints(standing.projected[t])}`]])) as Record<TeamId, string[]>;
  teamSplit(ctx, logos, top, 620, { og: fmtPoints(standing.points.og), south: fmtPoints(standing.points.south) }, sub);
  // Crest on the seam, over both halves.
  logo(ctx, logos, 'crest', W / 2, top - 110, 330);

  band(ctx, top + 620, standingsStatus(sessions, matches, standing.clinched));

  // Points by stage.
  const rowsTop = top + 770;
  text(ctx, 'By stage', W / 2, rowsTop, { size: 40, color: C.muted, spacing: 4 });
  const ordered = [...sessions].sort((a, b) => a.order - b.order);
  ordered.forEach((s, i) => {
    const y = rowsTop + 36 + i * 108;
    rect(ctx, 60, y, W - 120, 92, C.white, 14);
    const inSession = matches.filter(m => m.session === s.id);
    const played = inSession.some(m => matchStates(m).some(st => st.phase !== 'not-started'));
    const pts = cupStanding(inSession).points;
    text(ctx, `${s.day === 'fri' ? 'Fri' : 'Sat'} · ${s.name}`, 96, y + 64, { size: 50, color: C.ink, align: 'left', max: 560, spacing: 2 });
    text(ctx, played ? fmtPoints(pts.og) : '–', W - 260, y + 68, { size: 64, color: C.og });
    text(ctx, played ? fmtPoints(pts.south) : '–', W - 130, y + 68, { size: 64, color: C.south });
  });
}

function standingsStatus(sessions: Session[], matches: Match[], clinched: TeamId | null): string {
  if (clinched) return `${TEAM_NAMES[clinched]} win the Derby`;
  const ordered = [...sessions].sort((a, b) => a.order - b.order);
  const phases = (s: Session) => matches.filter(m => m.session === s.id).flatMap(m => matchStates(m).map(st => st.phase));
  const live = ordered.find(s => phases(s).some(p => p !== 'not-started') && phases(s).some(p => p !== 'final'));
  if (live) return `Live · ${dayAndSession(live)}`;
  const next = ordered.find(s => phases(s).every(p => p === 'not-started'));
  if (!next) return 'Final';
  return next.startsAt && Date.parse(next.startsAt) > Date.now() ? `Next · ${dayAndSession(next)} · ${teeDay(next.startsAt)}` : `Next · ${dayAndSession(next)}`;
}

/** A stage's points and every result in it. */
function drawRecap(ctx: Ctx, logos: Logos, { session, matches, byId }: Extract<CardSpec, { kind: 'recap' }>) {
  logo(ctx, logos, 'crest', W / 2, 190, 250);
  text(ctx, dayAndSession(session), W / 2, 540, { size: 84, color: C.og, spacing: 3 });
  const inSession = matches.filter(m => m.session === session.id);
  const done = decided(matches, session.id).sort((a, b) => a.slot - b.slot || (a.nine === 'back' ? 1 : 0) - (b.nine === 'back' ? 1 : 0));
  text(ctx, `${formatLabel(session)} · ${done.length < inSession.length ? 'Results so far' : 'Results'}`, W / 2, 600, { size: 44, color: C.gold, spacing: 3 });

  // Stage score, one half per team.
  const pts = cupStanding(inSession).points;
  const top = 650;
  for (const [i, t] of TEAMS.entries()) {
    const x0 = 60 + i * 480;
    rect(ctx, x0, top, 480, 220, TEAM_COLOR[t], 0);
    logo(ctx, logos, t, x0 + (i ? 380 : 100), top + 55, 110);
    text(ctx, fmtPoints(pts[t]), x0 + (i ? 150 : 330), top + 175, { size: 170, color: C.white });
  }

  // Results, as many rows as fit above the footer.
  const listTop = top + 260;
  const row = Math.min(96, Math.floor((1520 - listTop) / Math.max(1, done.length)));
  done.forEach((m, i) => {
    const y = listTop + i * row;
    const states = matchStates(m);
    const winner = states[0].winner;
    const color = winner ? TEAM_COLOR[winner] : C.gold;
    rect(ctx, 60, y, W - 120, row - 12, C.white, 12);
    rect(ctx, 60, y, 14, row - 12, color, 0);
    const size = Math.round(row * 0.46);
    const base = y + (row - 12) / 2 + size * 0.36;
    text(ctx, matchName(m), 100, base, { size: size * 0.75, color: C.muted, align: 'left', max: 250, spacing: 1 });
    text(ctx, winner ? sideName(m, winner, byId) : 'Halved', 370, base, { size, color, align: 'left', max: 480 });
    text(ctx, shortStatus(states), W - 90, base, { size, color, align: 'right', max: 160 });
  });
}

/** One match: who played, the result (or where it stands), and hole by hole. */
function drawMatch(ctx: Ctx, logos: Logos, { match, session, matches, byId }: Extract<CardSpec, { kind: 'match' }>) {
  logo(ctx, logos, 'crest', W / 2, 190, 250);
  text(ctx, session ? dayAndSession(session) : match.session, W / 2, 540, { size: 70, color: C.og, spacing: 3 });
  text(ctx, `${matchName(match)}${session ? ` · ${formatLabel(session)}` : ''}`, W / 2, 600, { size: 44, color: C.gold, spacing: 3 });

  // Result band in the leading side's color.
  const state = matchStates(match)[0];
  const lead = state.phase === 'final' ? state.winner : state.leader;
  const status =
    state.phase === 'not-started' ? (match.teeTime ? `Tees off ${teeClock(match.teeTime)}` : 'Not started')
    : state.phase === 'final' ? (state.winner ? `${TEAM_NAMES[state.winner]} win ${shortStatus([state])}` : 'Halved')
    : lead ? `${TEAM_NAMES[lead]} ${state.up} up thru ${state.thru}` : `All square thru ${state.thru}`;
  rect(ctx, 0, 650, W, 150, lead ? TEAM_COLOR[lead] : state.phase === 'final' ? C.gold : C.ink);
  text(ctx, status, W / 2, 755, { size: 96, color: C.white, spacing: 3 });

  // The two sides.
  for (const [i, t] of TEAMS.entries()) {
    const x0 = 60 + i * 510;
    const cx = x0 + 225;
    rect(ctx, x0, 850, 450, 380, C.white, 20);
    rect(ctx, x0, 850, 450, 16, TEAM_COLOR[t], 0);
    logo(ctx, logos, t, cx, 900, 90);
    text(ctx, TEAM_NAMES[t], cx, 1050, { size: 44, color: TEAM_COLOR[t], max: 400, spacing: 3 });
    const names = match.players[t].map(id => byId.get(id));
    const lines = names.length ? names.map(p => (p ? `${p.first} ${p.last}` : '')) : ['TBD'];
    lines.forEach((l, j) => text(ctx, l, cx, 1120 + j * 64, { size: 54, color: C.ink, max: 410 }));
  }

  // Hole by hole: a dot per hole in the winner's color.
  const holes = segments(match)[0] ?? [];
  const gap = (W - 160) / Math.max(1, holes.length);
  holes.forEach((h, i) => {
    const cx = 80 + gap * (i + 0.5);
    const o = holeOutcome(match, h);
    const after = state.afterClose.includes(h);
    ctx.globalAlpha = after ? 0.3 : 1;
    ctx.beginPath();
    ctx.arc(cx, 1330, 38, 0, Math.PI * 2);
    if (o) {
      ctx.fillStyle = o === 'halved' ? C.gold : TEAM_COLOR[o];
      ctx.fill();
    } else {
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.line;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    text(ctx, String(h), cx, 1345, { size: 40, color: o ? C.white : C.muted });
  });

  // Where the cup stands.
  const cup = cupStanding(matches).points;
  text(ctx, `Cup · ${TEAM_NAMES.og} ${fmtPoints(cup.og)} – ${fmtPoints(cup.south)} ${TEAM_NAMES.south}`, W / 2, 1470, { size: 48, color: C.ink, spacing: 2 });
}
