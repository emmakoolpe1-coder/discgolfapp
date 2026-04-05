/**
 * Flight chart path generation (feet space) and SVG conversion.
 * @typedef {{ x: number; y: number }} FlightPoint
 */

/** Assign in bag order; user can override per disc with `color` */
export const DISC_COLORS = [
  '#4ade80',
  '#60a5fa',
  '#f59e0b',
  '#f87171',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#38bdf8',
  '#e879f9',
  '#facc15',
  '#2dd4bf',
  '#fb7185',
];

export function parseFlightNum(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * True if a flight field is set (0 is valid; only null/undefined/empty string / non-finite number are not).
 * @param {unknown} v
 */
export function flightNumberFieldPresent(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim() !== '';
  return false;
}

/**
 * True when all four flight numbers are present and within chart / form ranges.
 * (speed 1–15, glide 0–7, turn -5–1, fade 0–5). Zero is valid for turn/fade/glide; disc_type is not required.
 * @param {{ speed?: unknown; glide?: unknown; turn?: unknown; fade?: unknown }} d
 */
export function hasValidFlightNumbersForChart(d) {
  if (!d) return false;
  if (!flightNumberFieldPresent(d.speed) || !flightNumberFieldPresent(d.glide) || !flightNumberFieldPresent(d.turn) || !flightNumberFieldPresent(d.fade)) {
    return false;
  }
  const s = parseFlightNum(d.speed);
  const g = parseFlightNum(d.glide);
  const t = parseFlightNum(d.turn);
  const f = parseFlightNum(d.fade);
  if (!Number.isFinite(s) || !Number.isFinite(g) || !Number.isFinite(t) || !Number.isFinite(f)) return false;
  return (
    s >= 1 &&
    s <= 15 &&
    g >= 0 &&
    g <= 7 &&
    t >= -5 &&
    t <= 1 &&
    f >= 0 &&
    f <= 5
  );
}

/** @param {unknown} c */
export function parseDiscColor(c) {
  if (typeof c !== 'string' || !c.trim()) return null;
  const s = c.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

/**
 * Composed red-mean color distance; &lt; 40 = too similar for assignment.
 * @param {string} hex1
 * @param {string} hex2
 */
export function colorDistance(hex1, hex2) {
  const a = parseDiscColor(hex1);
  const b = parseDiscColor(hex2);
  if (!a || !b) return 999;
  const r1 = parseInt(a.slice(1, 3), 16);
  const g1 = parseInt(a.slice(3, 5), 16);
  const b1 = parseInt(a.slice(5, 7), 16);
  const r2 = parseInt(b.slice(1, 3), 16);
  const g2 = parseInt(b.slice(3, 5), 16);
  const b2 = parseInt(b.slice(5, 7), 16);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (
    Math.sqrt(
      (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db
    ) / 3
  );
}

/**
 * @typedef {{ id: string; speed: number; userColor?: string | null }} DiscColorInput
 */

/**
 * @param {DiscColorInput[]} discs
 * @returns {{ discId: string; displayColor: string }[]}
 */
export function assignDiscColors(discs) {
  const usedColors = /** @type {string[]} */ ([]);
  /** @type {{ discId: string; displayColor: string | null }[]} */
  const result = [];
  const sorted = [...discs].sort((a, b) => b.speed - a.speed);

  for (const disc of sorted) {
    const uc = disc.userColor ? parseDiscColor(disc.userColor) : null;
    const idKey = String(disc.id);
    if (uc) {
      const tooSimilar = usedColors.some((c) => colorDistance(c, uc) < 40);
      if (!tooSimilar) {
        result.push({ discId: idKey, displayColor: uc });
        usedColors.push(uc);
      } else {
        result.push({ discId: idKey, displayColor: null });
      }
    } else {
      result.push({ discId: idKey, displayColor: null });
    }
  }

  let paletteIndex = 0;
  for (const entry of result) {
    if (entry.displayColor !== null) continue;
    let assigned = false;
    let tries = 0;
    while (!assigned && tries < DISC_COLORS.length * 3) {
      const candidate = DISC_COLORS[paletteIndex % DISC_COLORS.length];
      paletteIndex++;
      tries++;
      const tooSimilar = usedColors.some((c) => colorDistance(c, candidate) < 40);
      if (!tooSimilar) {
        entry.displayColor = candidate;
        usedColors.push(candidate);
        assigned = true;
      }
    }
    if (!assigned && entry.displayColor === null) {
      const fallback = DISC_COLORS[result.length % DISC_COLORS.length];
      entry.displayColor = fallback;
      usedColors.push(fallback);
    }
  }

  return result.map((e) => ({ discId: e.discId, displayColor: /** @type {string} */ (e.displayColor) }));
}

/**
 * @param {string} hex
 * @returns {{ h: number; s: number; l: number }}
 */
function hexToHsl(hex) {
  const p = parseDiscColor(hex);
  if (!p) return { h: 0, s: 0, l: 0 };
  const r = parseInt(p.slice(1, 3), 16) / 255;
  const g = parseInt(p.slice(3, 5), 16) / 255;
  const b = parseInt(p.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * @param {number} h 0–360
 * @param {number} s 0–100
 * @param {number} l 0–100
 */
function hslToHex(h, s, l) {
  let hue = ((h % 360) + 360) % 360;
  const S = s / 100;
  const L = l / 100;
  const hh = hue / 360;
  let r;
  let g;
  let b;
  if (S === 0) {
    r = g = b = L;
  } else {
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
    const p = 2 * L - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  const toHex = (n) =>
    Math.min(255, Math.max(0, Math.round(n * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Darken/boost saturation for light backgrounds (light mode only). */
export function adjustColorForLightMode(hex) {
  const p = parseDiscColor(hex);
  if (!p) return '#333333';
  const { h, s, l } = hexToHsl(p);
  const newL = Math.min(l, 50);
  const newS = Math.max(s, 50);
  return hslToHex(h, newS, newL);
}

/**
 * @typedef {{
 *   label: string;
 *   maxArmSpeed: number;
 *   baseDistPerSpeed: number;
 *   baseDistPerGlide: number;
 *   maxPossibleDist: number;
 *   turnEfficiency: number;
 *   fadeBias: number;
 * }} SkillProfile
 */

/** @type {Record<string, SkillProfile>} */
export const SKILL_PROFILES = {
  beginner: {
    label: 'Beginner',
    maxArmSpeed: 7,
    baseDistPerSpeed: 28,
    baseDistPerGlide: 10,
    maxPossibleDist: 280,
    turnEfficiency: 0.35,
    fadeBias: 1.5,
  },
  intermediate: {
    label: 'Intermediate',
    maxArmSpeed: 10,
    baseDistPerSpeed: 32,
    baseDistPerGlide: 14,
    maxPossibleDist: 400,
    turnEfficiency: 0.75,
    fadeBias: 1.15,
  },
  advanced: {
    label: 'Advanced',
    maxArmSpeed: 13,
    baseDistPerSpeed: 36,
    baseDistPerGlide: 16,
    maxPossibleDist: 550,
    turnEfficiency: 1.0,
    fadeBias: 1.0,
  },
};

/**
 * @typedef {{
 *   effectiveSpeed: number;
 *   effectiveGlide: number;
 *   effectiveTurn: number;
 *   effectiveFade: number;
 *   maxDistance: number;
 *   isOverspeed: boolean;
 *   overspeedAmount: number;
 * }} EffectiveFlightNumbers
 */

/**
 * @param {number} speed
 * @param {number} glide
 * @param {number} turn
 * @param {number} fade
 * @param {SkillProfile} skill
 * @returns {EffectiveFlightNumbers}
 */
export function getEffectiveFlightNumbers(speed, glide, turn, fade, skill) {
  const overspeed = Math.max(0, speed - skill.maxArmSpeed);
  const isOverspeed = overspeed > 0;

  const effectiveSpeed = Math.min(speed, skill.maxArmSpeed);

  const glideReduction = overspeed * 0.15;
  const effectiveGlide = Math.max(1, glide - glideReduction);

  const overspeedTurnPenalty = Math.pow(0.7, overspeed);
  const effectiveTurn = turn * skill.turnEfficiency * overspeedTurnPenalty;

  const overspeedFadeBonus = overspeed * 0.6;
  const effectiveFade = (fade + overspeedFadeBonus) * skill.fadeBias;

  const rawDist =
    effectiveSpeed * skill.baseDistPerSpeed + effectiveGlide * skill.baseDistPerGlide;
  const maxDistance = Math.min(rawDist, skill.maxPossibleDist);

  return {
    effectiveSpeed,
    effectiveGlide,
    effectiveTurn: Math.round(effectiveTurn * 10) / 10,
    effectiveFade: Math.round(effectiveFade * 10) / 10,
    maxDistance,
    isOverspeed,
    overspeedAmount: overspeed,
  };
}

/**
 * @param {EffectiveFlightNumbers} eff
 * @param {SkillProfile} skill
 * @param {{ turnMult?: number; fadeMult?: number; distMult?: number }} opts
 * @param {boolean} mirror
 * @returns {FlightPoint[]}
 */
export function integrateFlightPath(eff, skill, opts, mirror = false) {
  const turnMult = opts.turnMult ?? 1;
  const fadeMult = opts.fadeMult ?? 1;
  const distMult = opts.distMult ?? 1;

  const maxDistance = Math.min(eff.maxDistance * distMult, skill.maxPossibleDist);
  const turnStrength = -eff.effectiveTurn * 25 * turnMult;
  const fadeStrength = -eff.effectiveFade * 30 * fadeMult;

  const NUM_POINTS = 100;
  const dt = 1 / NUM_POINTS;
  /** @type {FlightPoint[]} */
  const points = [{ x: 0, y: 0 }];
  let xPos = 0;

  for (let i = 1; i <= NUM_POINTS; i++) {
    const t = i / NUM_POINTS;
    const y = maxDistance * t;

    const turnVelocity = turnStrength * Math.exp(-Math.pow((t - 0.28) / 0.18, 2));

    const fadeT = Math.max(0, (t - 0.45) / 0.55);
    const fadeVelocity = fadeStrength * Math.pow(fadeT, 1.8);

    xPos += (turnVelocity + fadeVelocity) * dt;
    const x = mirror ? -xPos : xPos;
    points.push({ x, y });
  }

  return points;
}

/**
 * RHFH/LHBH path from RHBH/LHFH: negate lateral (x). Same as integrateFlightPath(..., mirror: true).
 * @param {FlightPoint[]} points
 * @returns {FlightPoint[]}
 */
export function flipFlightPointsHorizontal(points) {
  if (!points?.length) return points;
  return points.map((p) => ({ x: -p.x, y: p.y }));
}

/**
 * Mirrored bag paths from standard (negate x per disc).
 * @param {DiscFlightData[]} flights
 * @returns {DiscFlightData[]}
 */
export function mapDiscFlightsFlipHorizontal(flights) {
  if (!flights?.length) return [];
  return flights.map((f) => ({
    ...f,
    paths: { standard: flipFlightPointsHorizontal(f.paths.standard) },
  }));
}

/**
 * @param {number} speed
 * @param {number} glide
 * @param {number} turn
 * @param {number} fade
 * @param {string} skillLevel
 * @param {boolean} mirror
 * @returns {FlightPoint[]}
 */
export function generateSkillFlightPath(speed, glide, turn, fade, skillLevel = 'intermediate', mirror = false) {
  const skill = SKILL_PROFILES[skillLevel] ?? SKILL_PROFILES.intermediate;
  const eff = getEffectiveFlightNumbers(speed, glide, turn, fade, skill);
  return integrateFlightPath(eff, skill, { turnMult: 1, fadeMult: 1, distMult: 1 }, mirror);
}

/**
 * Low / standard / high power paths for envelope (same effective numbers).
 * @returns {{ low: FlightPoint[]; standard: FlightPoint[]; high: FlightPoint[] }}
 */
export function generatePowerEnvelopePaths(speed, glide, turn, fade, skillLevel = 'intermediate', mirror = false) {
  const skill = SKILL_PROFILES[skillLevel] ?? SKILL_PROFILES.intermediate;
  const eff = getEffectiveFlightNumbers(speed, glide, turn, fade, skill);

  const low = integrateFlightPath(eff, skill, { turnMult: 0.7, fadeMult: 1.3, distMult: 0.85 }, mirror);
  const standard = integrateFlightPath(eff, skill, { turnMult: 1, fadeMult: 1, distMult: 1 }, mirror);
  const high = integrateFlightPath(eff, skill, { turnMult: 1.3, fadeMult: 0.7, distMult: 1.1 }, mirror);

  return { low, standard, high };
}

/**
 * @typedef {{ id: string; name: string; speed: number; glide: number; turn: number; fade: number; color?: string | null }} DiscDefinition
 * @typedef {{
 *   disc: DiscDefinition;
 *   color: string;
 *   paths: { standard: FlightPoint[] };
 *   effective: EffectiveFlightNumbers;
 * }} DiscFlightData
 */

/**
 * Round chart max Y up to nearest 50 ft (for axis + grid).
 * @param {number} ft
 */
export function roundDistanceAxisMax(ft) {
  if (!Number.isFinite(ft) || ft <= 0) return 50;
  return Math.ceil(ft / 50) * 50;
}

/**
 * Horizontal grid lines every 150 ft from 0 through maxFt.
 * @param {number} maxFt
 * @returns {number[]}
 */
export function buildYGridTicks150(maxFt) {
  /** @type {number[]} */
  const ticks = [];
  for (let v = 0; v <= maxFt + 1e-6; v += 150) ticks.push(Math.round(v));
  return ticks;
}

/**
 * @param {DiscDefinition[]} discs
 * @param {string} [skillLevel]
 * @param {boolean} [mirror]
 * @returns {{ flights: DiscFlightData[]; maxDistance: number; maxLateral: number; discWarnings: Map<string, string> }}
 */
export function generateBagFlightData(discs, skillLevel = 'intermediate', mirror = false) {
  const skill = SKILL_PROFILES[skillLevel] ?? SKILL_PROFILES.intermediate;
  const sorted = [...discs].sort((a, b) => b.speed - a.speed);

  let maxDistance = 0;
  let maxLateral = 30;
  /** @type {Map<string, string>} */
  const discWarnings = new Map();

  const flights = sorted.map((disc, index) => {
    const points = generateSkillFlightPath(
      disc.speed,
      disc.glide,
      disc.turn,
      disc.fade,
      skillLevel,
      mirror
    );

    const custom = parseDiscColor(disc.color);
    const color = custom ?? DISC_COLORS[index % DISC_COLORS.length];

    const effective = getEffectiveFlightNumbers(
      disc.speed,
      disc.glide,
      disc.turn,
      disc.fade,
      skill
    );

    if (effective.isOverspeed) {
      discWarnings.set(
        disc.id,
        `Speed ${disc.speed} disc — you need ${disc.speed - skill.maxArmSpeed} more speed to unlock full flight`
      );
    }

    for (const point of points) {
      maxDistance = Math.max(maxDistance, point.y);
      maxLateral = Math.max(maxLateral, Math.abs(point.x));
    }

    return {
      disc,
      color,
      paths: { standard: points },
      effective,
    };
  });

  maxDistance *= 1.1;
  maxLateral *= 1.15;

  const axisMax = roundDistanceAxisMax(maxDistance);

  return { flights, maxDistance: axisMax, maxLateral, discWarnings };
}

/**
 * @param {FlightPoint[]} points
 * @param {number} yTarget
 */
export function interpolateXAtY(points, yTarget) {
  if (!points.length) return 0;
  if (yTarget <= points[0].y) return points[0].x;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y >= yTarget) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const t = (yTarget - p0.y) / (p1.y - p0.y + 1e-9);
      return p0.x + t * (p1.x - p0.x);
    }
  }
  return points[points.length - 1].x;
}

/**
 * Map feet → SVG user space. x ∈ [-maxLateral, +maxLateral] → full inner width.
 * y ∈ [0, maxDistance] bottom → top.
 */
export function feetToSVG(
  p,
  chartWidth,
  chartHeight,
  maxLateralFeet,
  maxDistanceFeet,
  pad = { left: 36, right: 8, top: 8, bottom: 8 }
) {
  const ml = Math.max(maxLateralFeet, 1e-6);
  const md = Math.max(maxDistanceFeet, 1e-6);
  const innerW = chartWidth - pad.left - pad.right;
  const innerH = chartHeight - pad.top - pad.bottom;
  const sx = pad.left + ((p.x + ml) / (2 * ml)) * innerW;
  const sy = pad.top + innerH - (p.y / md) * innerH;
  return { sx, sy };
}

/**
 * Catmull-Rom style smooth cubic through points (SVG pixel space).
 * When turn=0 and fade=0, all foot-space x are 0 → collinear vertical in SVG (constant sx).
 * Pure-vertical (or pure-horizontal) polylines break degenerate cubics in some engines; use line segments.
 * @param {{ sx: number; sy: number }[]} pts
 */
function smoothBezierThroughPoints(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].sx} ${pts[0].sy} L ${pts[1].sx} ${pts[1].sy}`;
  }
  let minSx = Infinity;
  let maxSx = -Infinity;
  let minSy = Infinity;
  let maxSy = -Infinity;
  for (const p of pts) {
    if (p.sx < minSx) minSx = p.sx;
    if (p.sx > maxSx) maxSx = p.sx;
    if (p.sy < minSy) minSy = p.sy;
    if (p.sy > maxSy) maxSy = p.sy;
  }
  const sxSpread = maxSx - minSx;
  const sySpread = maxSy - minSy;
  const COLLINEAR_EPS = 0.05;
  if (sxSpread < COLLINEAR_EPS || sySpread < COLLINEAR_EPS) {
    let d = `M ${pts[0].sx.toFixed(2)} ${pts[0].sy.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].sx.toFixed(2)} ${pts[i].sy.toFixed(2)}`;
    }
    return d;
  }
  let d = `M ${pts[0].sx} ${pts[0].sy}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.sx + (p2.sx - p0.sx) / 6;
    const cp1y = p1.sy + (p2.sy - p0.sy) / 6;
    const cp2x = p2.sx - (p3.sx - p1.sx) / 6;
    const cp2y = p2.sy - (p3.sy - p1.sy) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.sx} ${p2.sy}`;
  }
  return d;
}

/**
 * Smooth cubic bezier path for flight (polyline → spline).
 * @param {FlightPoint[]} points
 */
export function flightPointsToSmoothSVGPath(
  points,
  chartWidth,
  chartHeight,
  maxLateralFeet,
  maxDistanceFeet,
  pad = { left: 36, right: 8, top: 8, bottom: 8 }
) {
  if (!points.length) return '';
  const pts = points.map((p) => feetToSVG(p, chartWidth, chartHeight, maxLateralFeet, maxDistanceFeet, pad));
  return smoothBezierThroughPoints(pts);
}

/**
 * Legacy straight-line path (kept for envelopes / hit testing if needed).
 */
export function flightPointsToSVGPath(
  points,
  chartWidth,
  chartHeight,
  maxLateralFeet,
  maxDistanceFeet,
  pad = { left: 36, right: 8, top: 8, bottom: 8 }
) {
  if (!points.length) return '';
  const svgPoints = points.map((p) => feetToSVG(p, chartWidth, chartHeight, maxLateralFeet, maxDistanceFeet, pad));
  let d = `M ${svgPoints[0].sx.toFixed(2)} ${svgPoints[0].sy.toFixed(2)}`;
  for (let i = 1; i < svgPoints.length; i++) {
    d += ` L ${svgPoints[i].sx.toFixed(2)} ${svgPoints[i].sy.toFixed(2)}`;
  }
  return d;
}

/**
 * Closed path: path1 forward + path2 reversed (linear segments; fill).
 * @param {FlightPoint[]} path1
 * @param {FlightPoint[]} path2
 */
export function flightEnvelopePath(
  path1,
  path2,
  chartWidth,
  chartHeight,
  maxLateralFeet,
  maxDistanceFeet,
  pad = { left: 36, right: 8, top: 8, bottom: 8 }
) {
  const toSVG = (p) => feetToSVG(p, chartWidth, chartHeight, maxLateralFeet, maxDistanceFeet, pad);

  const forward = path1.map(toSVG);
  const backward = [...path2].reverse().map(toSVG);

  let d = `M ${forward[0].sx.toFixed(2)} ${forward[0].sy.toFixed(2)}`;
  for (let i = 1; i < forward.length; i++) {
    d += ` L ${forward[i].sx.toFixed(2)} ${forward[i].sy.toFixed(2)}`;
  }
  for (const pt of backward) {
    d += ` L ${pt.sx.toFixed(2)} ${pt.sy.toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

/**
 * @param {FlightPoint[]} points
 * @returns {{ sx: number; sy: number }}
 */
export function flightPointToSVG(
  points,
  chartWidth,
  chartHeight,
  maxLateralFeet,
  maxDistanceFeet,
  index = -1,
  pad = { left: 36, right: 8, top: 8, bottom: 8 }
) {
  const p = index >= 0 ? points[Math.min(index, points.length - 1)] : points[points.length - 1];
  return feetToSVG(p, chartWidth, chartHeight, maxLateralFeet, maxDistanceFeet, pad);
}

/**
 * @param {FlightPoint[]} a
 * @param {FlightPoint[]} b
 * @param {number} t
 * @returns {FlightPoint[]}
 */
export function lerpFlightPoints(a, b, t) {
  if (!a.length || !b.length || a.length !== b.length) return b.length ? b : a;
  return a.map((pa, i) => ({
    x: pa.x + (b[i].x - pa.x) * t,
    y: pa.y + (b[i].y - pa.y) * t,
  }));
}

export function buildCombinedBagEnvelopeBoundaryPaths(flights) {
  const allPaths = [];
  for (const f of flights) {
    allPaths.push(f.paths.standard);
  }
  if (!allPaths.length) {
    return { leftPath: [{ x: 0, y: 0 }], rightPath: [{ x: 0, y: 0 }] };
  }

  let maxY = 0;
  for (const pts of allPaths) {
    for (const p of pts) maxY = Math.max(maxY, p.y);
  }

  const steps = 100;
  /** @type {FlightPoint[]} */
  const leftPts = [];
  /** @type {FlightPoint[]} */
  const rightPts = [];

  for (let s = 0; s <= steps; s++) {
    const y = (s / steps) * maxY;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const pts of allPaths) {
      const x = interpolateXAtY(pts, y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX)) {
      leftPts.push({ x: minX, y });
      rightPts.push({ x: maxX, y });
    }
  }

  return { leftPath: leftPts, rightPath: rightPts };
}
