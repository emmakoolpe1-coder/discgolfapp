import { useMemo, useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { motion as Motion, AnimatePresence, animate } from 'framer-motion';
import {
  parseFlightNum,
  parseDiscColor,
  assignDiscColors,
  adjustColorForLightMode,
  generateBagFlightData,
  flightPointsToSmoothSVGPath,
  flightPointToSVG,
  flightEnvelopePath,
  lerpFlightPoints,
  generatePowerEnvelopePaths,
  buildYGridTicks150,
  SKILL_PROFILES,
  hasValidFlightNumbersForChart,
} from '../flightChartMath.js';

const CHART_W = 400;
const CHART_H_DEFAULT = 400;
const CHART_H_NARROW = 350;
const HIT_STROKE = 24;
const PATH_PAD = { left: 36, right: 8, top: 8, bottom: 8 };
const PATH_TRANSITION = { duration: 0.3, ease: [0.42, 0, 0.58, 1] };
const HINT_KEY = 'bagChart_discovered';

/** Same disc id regardless of string vs number (Firestore / localStorage). 0 is valid; do not use == or truthiness on ids. */
function discIdsEqual(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function hasSelectedDiscId(id) {
  return id != null && String(id).length > 0;
}

/** @param {import('../flightChartMath.js').DiscFlightData[]} a */
/** @param {import('../flightChartMath.js').DiscFlightData[]} b */
function flightsMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((f, i) => discIdsEqual(f.disc.id, b[i].disc.id));
}

/** @param {string} hex */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const SKILL_OPTIONS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

/** RHBH/LHFH → unmirrored path; LHBH/RHFH → mirrored (same as legacy LHBH). */
const HAND_FLIGHT_PAIR = {
  RHBH_LHFH: 'RHBH_LHFH',
  LHBH_RHFH: 'LHBH_RHFH',
};

function useNarrowChartHeight() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 359px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 359px)');
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return narrow ? CHART_H_NARROW : CHART_H_DEFAULT;
}

function getChartEffectiveTheme() {
  if (typeof document === 'undefined') return 'dark';
  const t = document.documentElement.getAttribute('data-theme') || 'system';
  if (t === 'dark') return 'dark';
  if (t === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useChartEffectiveTheme() {
  const [mode, setMode] = useState(() => getChartEffectiveTheme());
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setMode(getChartEffectiveTheme());
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    mq.addEventListener('change', update);
    return () => {
      obs.disconnect();
      mq.removeEventListener('change', update);
    };
  }, []);
  return mode;
}

/**
 * @param {{ bagDiscs: any[] }} props
 */
export default function FlightChart({ bagDiscs }) {
  const chartH = useNarrowChartHeight();
  const effectiveChartMode = useChartEffectiveTheme();
  const chartableDiscs = useMemo(
    () => (bagDiscs ?? []).filter(hasValidFlightNumbersForChart),
    [bagDiscs]
  );
  const [handPair, setHandPair] = useState(/** @type {keyof typeof HAND_FLIGHT_PAIR} */ (HAND_FLIGHT_PAIR.RHBH_LHFH));
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [selectedDiscId, setSelectedDiscId] = useState(/** @type {string | null} */ (null));
  const chipScrollRef = useRef(null);
  const chipRefs = useRef(/** @type {Record<string, HTMLButtonElement | null>} */ ({}));
  const userInteractedRef = useRef(false);
  /** Set only from selectDisc when choosing a disc; never from auto-select — avoids scrollIntoView on load */
  const pendingChipScrollRef = useRef(false);
  const [bounceChipId, setBounceChipId] = useState(/** @type {string | null} */ (null));
  const [hintPhase, setHintPhase] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(HINT_KEY) === 'true') return 'gone';
    } catch {
      /* ignore */
    }
    return 'initial';
  });

  /** @type {React.MutableRefObject<{ flights: import('../flightChartMath.js').DiscFlightData[]; maxDistance: number; maxLateral: number } | null>} */
  const snapshotRef = useRef(null);

  const [animDisplay, setAnimDisplay] = useState(
    /** @type {{ flights: import('../flightChartMath.js').DiscFlightData[]; maxDistance: number; maxLateral: number } | null} */ (null)
  );

  const mirror = handPair === HAND_FLIGHT_PAIR.LHBH_RHFH;

  const discsForColorAssignment = useMemo(
    () =>
      chartableDiscs.map((d) => ({
        id: d.id,
        speed: parseFlightNum(d.speed),
        userColor: parseDiscColor(d.userColor) ?? parseDiscColor(d.color),
      })),
    [chartableDiscs]
  );

  const colorById = useMemo(() => {
    const m = new Map();
    for (const row of assignDiscColors(discsForColorAssignment)) {
      m.set(row.discId, row.displayColor);
    }
    return m;
  }, [discsForColorAssignment]);

  const definitions = useMemo(() => {
    if (!chartableDiscs.length) return [];
    return chartableDiscs.map((d) => {
      const base = colorById.get(d.id) ?? '#888888';
      const color =
        effectiveChartMode === 'light' ? adjustColorForLightMode(base) : base;
      return {
        id: d.id,
        name: d.custom_name || d.mold || 'Disc',
        speed: parseFlightNum(d.speed),
        glide: parseFlightNum(d.glide),
        turn: parseFlightNum(d.turn),
        fade: parseFlightNum(d.fade),
        color,
      };
    });
  }, [chartableDiscs, colorById, effectiveChartMode]);

  const { flights, maxDistance, maxLateral, discWarnings } = useMemo(() => {
    if (!definitions.length) {
      return {
        flights: [],
        maxDistance: 400,
        maxLateral: 30,
        discWarnings: /** @type {Map<string, string>} */ (new Map()),
      };
    }

    const data = generateBagFlightData(definitions, skillLevel, mirror);

    return {
      flights: data.flights,
      maxDistance: data.maxDistance,
      maxLateral: data.maxLateral,
      discWarnings: data.discWarnings,
    };
  }, [definitions, mirror, skillLevel]);

  const displayFlights = animDisplay?.flights ?? flights;
  const displayMaxDistance = animDisplay?.maxDistance ?? maxDistance;
  const displayMaxLateral = animDisplay?.maxLateral ?? maxLateral;

  useLayoutEffect(() => {
    const next = { flights, maxDistance, maxLateral };
    const prev = snapshotRef.current;

    if (!prev || !flightsMatch(prev.flights, next.flights)) {
      snapshotRef.current = next;
      queueMicrotask(() => setAnimDisplay(null));
      return;
    }

    const controls = animate(0, 1, {
      ...PATH_TRANSITION,
      onUpdate: (t) => {
        setAnimDisplay({
          flights: next.flights.map((f, i) => ({
            ...f,
            paths: {
              standard: lerpFlightPoints(
                prev.flights[i].paths.standard,
                f.paths.standard,
                t
              ),
            },
          })),
          maxDistance: prev.maxDistance + (next.maxDistance - prev.maxDistance) * t,
          maxLateral: prev.maxLateral + (next.maxLateral - prev.maxLateral) * t,
        });
      },
      onComplete: () => {
        snapshotRef.current = next;
        setAnimDisplay(null);
      },
    });

    return () => controls.stop();
  }, [flights, maxDistance, maxLateral]);

  const secondDiscIdForBounce = useMemo(
    () => (flights.length >= 2 ? flights[1].disc.id : null),
    [flights]
  );

  /** Clear selection if no chartable discs or selected disc removed */
  useEffect(() => {
    if (!chartableDiscs.length) {
      queueMicrotask(() => setSelectedDiscId(null));
      return;
    }
    queueMicrotask(() => {
      setSelectedDiscId((prev) =>
        hasSelectedDiscId(prev) && !chartableDiscs.some((d) => discIdsEqual(d.id, prev)) ? null : prev
      );
    });
  }, [chartableDiscs]);

  /** Auto-select fastest chartable disc on load / when selection invalid */
  useEffect(() => {
    if (!chartableDiscs.length) return;
    const sorted = [...chartableDiscs].sort((a, b) => parseFlightNum(b.speed) - parseFlightNum(a.speed));
    const firstId = sorted[0].id;
    queueMicrotask(() => {
      setSelectedDiscId((prev) => {
        if (hasSelectedDiscId(prev) && chartableDiscs.some((d) => discIdsEqual(d.id, prev))) return prev;
        return firstId;
      });
    });
  }, [chartableDiscs]);

  /** Second chip bounce @ 2s, once, if no interaction */
  useEffect(() => {
    if (!secondDiscIdForBounce) return;
    const t = window.setTimeout(() => {
      if (userInteractedRef.current) return;
      setBounceChipId(secondDiscIdForBounce);
      window.setTimeout(() => setBounceChipId(null), 400);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [secondDiscIdForBounce]);

  const yTicks = useMemo(() => buildYGridTicks150(displayMaxDistance), [displayMaxDistance]);

  const pathD = useCallback(
    (pts) =>
      flightPointsToSmoothSVGPath(
        pts,
        CHART_W,
        chartH,
        displayMaxLateral,
        displayMaxDistance,
        PATH_PAD
      ),
    [displayMaxLateral, displayMaxDistance, chartH]
  );

  const selectedFlight = useMemo(
    () => flights.find((f) => discIdsEqual(f.disc.id, selectedDiscId)) ?? null,
    [flights, selectedDiscId]
  );

  const envelopePaths = useMemo(() => {
    if (!selectedFlight) return null;
    const d = selectedFlight.disc;
    return generatePowerEnvelopePaths(d.speed, d.glide, d.turn, d.fade, skillLevel, mirror);
  }, [selectedFlight, skillLevel, mirror]);

  const envelopeD = useMemo(() => {
    if (!envelopePaths || !selectedFlight) return null;
    return flightEnvelopePath(
      envelopePaths.high,
      envelopePaths.low,
      CHART_W,
      chartH,
      displayMaxLateral,
      displayMaxDistance,
      PATH_PAD
    );
  }, [envelopePaths, selectedFlight, chartH, displayMaxLateral, displayMaxDistance]);

  const isAnimating = animDisplay != null;
  /** Envelope / variants / dot only when paths match (not mid-lerp) */
  const showDetailLayers = hasSelectedDiscId(selectedDiscId) && !isAnimating;

  const selectedDisplayFlight = useMemo(
    () => displayFlights.find((f) => discIdsEqual(f.disc.id, selectedDiscId)) ?? null,
    [displayFlights, selectedDiscId]
  );

  const finishHintForever = useCallback(() => {
    try {
      localStorage.setItem(HINT_KEY, 'true');
    } catch {
      /* ignore */
    }
    setHintPhase('gone');
  }, []);

  const selectDisc = useCallback(
    (id) => {
      userInteractedRef.current = true;
      setSelectedDiscId((prev) => {
        if (discIdsEqual(prev, id)) {
          queueMicrotask(finishHintForever);
          return null;
        }
        pendingChipScrollRef.current = true;
        queueMicrotask(() => {
          setHintPhase((h) => (h === 'initial' ? 'second' : h));
        });
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        return id;
      });
    },
    [finishHintForever]
  );

  useEffect(() => {
    if (!hasSelectedDiscId(selectedDiscId)) return;
    if (!pendingChipScrollRef.current) return;
    pendingChipScrollRef.current = false;
    const el = chipRefs.current[String(selectedDiscId)];
    if (el && chipScrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDiscId]);

  const onBgClick = useCallback(() => {
    userInteractedRef.current = true;
    setSelectedDiscId((prev) => {
      if (prev != null) queueMicrotask(finishHintForever);
      return null;
    });
  }, [finishHintForever]);

  const skillLabel = SKILL_PROFILES[skillLevel]?.label ?? skillLevel;
  const handLabel = useMemo(
    () =>
      handPair === HAND_FLIGHT_PAIR.LHBH_RHFH ? 'LHBH / RHFH' : 'RHBH / LHFH',
    [handPair]
  );

  const svgAria = useMemo(() => {
    const n = displayFlights.length;
    return `Bag flight chart showing ${n} disc${n !== 1 ? 's' : ''} at ${skillLabel} level, ${handLabel} throw`;
  }, [displayFlights.length, skillLabel, handLabel]);

  if (!bagDiscs?.length) return null;

  if (!chartableDiscs.length) {
    return (
      <div
        className="flight-chart-card flight-chart-themed w-full max-w-[500px] mx-auto rounded-2xl p-4 box-border border border-solid overflow-hidden"
        style={{
          width: '100%',
          overflowX: 'hidden',
          backgroundColor: 'var(--chart-card-bg)',
          borderColor: 'var(--chart-card-border)',
        }}
      >
        <h2
          className="text-[18px] font-bold mb-3 flight-chart-themed"
          style={{ color: 'var(--chart-title-text)' }}
        >
          Bag Overview
        </h2>
        <p
          className="text-center text-sm py-10 px-3 flight-chart-themed"
          style={{ color: 'var(--chart-body-text)' }}
        >
          Enter flight numbers to see the flight path
        </p>
      </div>
    );
  }

  const discColor = selectedFlight?.color ?? '#888888';

  return (
    <div
      className="flight-chart-card flight-chart-themed w-full max-w-[500px] mx-auto rounded-2xl p-4 box-border border border-solid overflow-hidden"
      style={{
        width: '100%',
        overflowX: 'hidden',
        backgroundColor: 'var(--chart-card-bg)',
        borderColor: 'var(--chart-card-border)',
      }}
    >
      <h2
        className="text-[18px] font-bold mb-3 flight-chart-themed"
        style={{ color: 'var(--chart-title-text)' }}
      >
        Bag Overview
      </h2>

      <AnimatePresence initial={false}>
        {selectedFlight && (
          <Motion.div
            key="selected-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-2 rounded-lg px-3 py-2.5 flight-chart-themed"
            style={{
              backgroundColor: 'var(--chart-banner-bg)',
              borderBottom: '1px solid var(--chart-banner-border)',
            }}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span
                className="shrink-0 rounded-full"
                style={{ width: 10, height: 10, backgroundColor: discColor }}
                aria-hidden
              />
              <span className="font-bold text-[16px]" style={{ color: 'var(--chart-title-text)' }}>
                {selectedFlight.disc.name}
              </span>
              <span
                className="text-[13px] tabular-nums"
                style={{ color: 'var(--chart-banner-nums)' }}
              >
                {selectedFlight.disc.speed} | {selectedFlight.disc.glide} | {selectedFlight.disc.turn} |{' '}
                {selectedFlight.disc.fade}
              </span>
            </div>
            {selectedFlight.effective.isOverspeed && (
              <div className="text-center text-[13px] mt-1 tabular-nums" style={{ color: discColor }}>
                Your flight: {selectedFlight.effective.effectiveSpeed} |{' '}
                {Math.round(selectedFlight.effective.effectiveGlide * 10) / 10} |{' '}
                {selectedFlight.effective.effectiveTurn} | {selectedFlight.effective.effectiveFade}
              </div>
            )}
            {selectedFlight.effective.isOverspeed && (
              <p
                className="text-[11px] italic text-center mt-1"
                style={{ color: 'var(--chart-warning)' }}
              >
                ⚠ This disc is faster than your arm speed
              </p>
            )}
          </Motion.div>
        )}
      </AnimatePresence>

      <fieldset className="border-0 p-0 m-0 mb-2">
        <legend className="sr-only">Throw type</legend>
        <div
          className="flex w-full rounded-[18px] overflow-hidden p-0.5 gap-0.5 min-h-[36px] flight-chart-themed"
          style={{ backgroundColor: 'var(--chart-toggle-bg)' }}
          role="radiogroup"
          aria-label="Throw type: RHBH and LHFH together, or LHBH and RHFH together"
        >
          <button
            type="button"
            role="radio"
            aria-checked={handPair === HAND_FLIGHT_PAIR.RHBH_LHFH}
            onClick={() => setHandPair(HAND_FLIGHT_PAIR.RHBH_LHFH)}
            className="no-hover-scale flex-1 min-h-[36px] rounded-2xl text-[13px] font-bold transition-colors duration-200 ease-out flight-chart-themed"
            style={
              handPair === HAND_FLIGHT_PAIR.RHBH_LHFH
                ? {
                    backgroundColor: 'var(--chart-toggle-active-bg)',
                    color: 'var(--chart-toggle-active-text)',
                  }
                : { backgroundColor: 'transparent', color: 'var(--chart-toggle-inactive-text)' }
            }
          >
            RHBH / LHFH
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={handPair === HAND_FLIGHT_PAIR.LHBH_RHFH}
            onClick={() => setHandPair(HAND_FLIGHT_PAIR.LHBH_RHFH)}
            className="no-hover-scale flex-1 min-h-[36px] rounded-2xl text-[13px] font-bold transition-colors duration-200 ease-out flight-chart-themed"
            style={
              handPair === HAND_FLIGHT_PAIR.LHBH_RHFH
                ? {
                    backgroundColor: 'var(--chart-toggle-active-bg)',
                    color: 'var(--chart-toggle-active-text)',
                  }
                : { backgroundColor: 'transparent', color: 'var(--chart-toggle-inactive-text)' }
            }
          >
            LHBH / RHFH
          </button>
        </div>
      </fieldset>

      <fieldset className="border-0 p-0 m-0 mb-3">
        <legend className="sr-only">Skill level</legend>
        <div
          className="flex w-full rounded-[20px] overflow-hidden p-0.5 gap-0.5 min-h-[40px] flight-chart-themed"
          style={{ backgroundColor: 'var(--chart-toggle-bg)' }}
          role="radiogroup"
          aria-label="Skill level"
        >
          {SKILL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={skillLevel === opt.id}
              onClick={() => setSkillLevel(opt.id)}
              className={`no-hover-scale flex-1 min-h-[40px] rounded-2xl text-[13px] transition-colors duration-200 ease-out flight-chart-themed ${
                skillLevel === opt.id ? 'font-bold' : 'font-normal'
              }`}
              style={
                skillLevel === opt.id
                  ? {
                      backgroundColor: 'var(--chart-toggle-active-bg)',
                      color: 'var(--chart-toggle-active-text)',
                    }
                  : {
                      backgroundColor: 'var(--chart-skill-inactive-bg)',
                      color: 'var(--chart-toggle-inactive-text)',
                    }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="w-full max-[319px]:min-h-[350px] min-h-[400px]">
        <svg
          width="100%"
          viewBox={`0 0 ${CHART_W} ${chartH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ maxWidth: '100%', height: 'auto' }}
          role="img"
          aria-label={svgAria}
          onClick={onBgClick}
        >
          <defs />
          <rect width={CHART_W} height={chartH} fill="transparent" pointerEvents="none" />

          <g pointerEvents="none">
            {yTicks.map((ft) => {
              if (ft <= 0 || ft > displayMaxDistance) return null;
              const innerH = chartH - PATH_PAD.top - PATH_PAD.bottom;
              const sy = PATH_PAD.top + innerH - (ft / displayMaxDistance) * innerH;
              return (
                <line
                  key={`grid-${ft}`}
                  x1={PATH_PAD.left}
                  y1={sy}
                  x2={CHART_W - PATH_PAD.right}
                  y2={sy}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                  className="chart-svg-path"
                />
              );
            })}
            <line
              x1={CHART_W / 2}
              y1={PATH_PAD.top}
              x2={CHART_W / 2}
              y2={chartH - PATH_PAD.bottom}
              stroke="var(--chart-center-line)"
              strokeWidth={1}
              className="chart-svg-path"
            />
          </g>

          {yTicks.map((ft) => {
            if (ft > displayMaxDistance + 1) return null;
            const innerH = chartH - PATH_PAD.top - PATH_PAD.bottom;
            const sy = PATH_PAD.top + innerH - (ft / displayMaxDistance) * innerH;
            const textY = ft === 0 ? chartH - PATH_PAD.bottom - 2 : Math.min(chartH - 4, sy + 4);
            return (
              <text
                key={`ylab-${ft}`}
                x={6}
                y={textY}
                fill="var(--chart-axis-label)"
                fontSize={11}
                pointerEvents="none"
                className="font-mono chart-svg-path"
              >
                {ft}&apos;
              </text>
            );
          })}

          {/* Layer 2: non-selected paths (overview: all paths here) */}
          {displayFlights.map((flight) => {
            if (hasSelectedDiscId(selectedDiscId) && discIdsEqual(flight.disc.id, selectedDiscId)) return null;
            const std = flight.paths.standard;
            const d = pathD(std);
            const overview = selectedDiscId == null;
            const strokeW = overview ? 2.5 : 1.5;

            return (
              <path
                key={`line-${flight.disc.id}`}
                d={d}
                fill="none"
                stroke={flight.color}
                strokeWidth={strokeW}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-svg-path"
                pointerEvents="none"
                style={{
                  opacity: overview ? 'var(--chart-path-opacity-default)' : 'var(--chart-path-dimmed)',
                  transition: 'opacity 250ms ease, stroke-width 250ms ease, stroke 200ms ease',
                }}
              />
            );
          })}

          {/* Layer 3–6: selected detail (envelope, dashed variants, main line, dot) */}
          {showDetailLayers &&
            selectedFlight &&
            selectedDisplayFlight &&
            envelopePaths &&
            envelopeD && (
              <g pointerEvents="none">
                <path
                  d={envelopeD}
                  fill={discColor}
                  fillOpacity="var(--chart-envelope-opacity)"
                  stroke="none"
                  className="chart-svg-path"
                />
                <path
                  d={pathD(envelopePaths.low)}
                  fill="none"
                  stroke={discColor}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="var(--chart-variant-opacity)"
                  className="chart-svg-path"
                />
                <path
                  d={pathD(envelopePaths.high)}
                  fill="none"
                  stroke={discColor}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="var(--chart-variant-opacity)"
                  className="chart-svg-path"
                />
                <path
                  d={pathD(selectedDisplayFlight.paths.standard)}
                  fill="none"
                  stroke={discColor}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={1}
                  className="chart-svg-path"
                />
                {(() => {
                  const std = selectedDisplayFlight.paths.standard;
                  const { sx, sy } = flightPointToSVG(
                    std,
                    CHART_W,
                    chartH,
                    displayMaxLateral,
                    displayMaxDistance,
                    std.length - 1,
                    PATH_PAD
                  );
                  return (
                    <circle
                      cx={sx}
                      cy={sy}
                      r={6}
                      fill={discColor}
                      className="chart-svg-path"
                      style={{ transition: 'cx 300ms ease-in-out, cy 300ms ease-in-out, fill 200ms ease' }}
                    />
                  );
                })()}
              </g>
            )}

          {/* Selected disc main line only while paths are animating (skill/hand change) */}
          {hasSelectedDiscId(selectedDiscId) &&
            selectedDisplayFlight &&
            selectedFlight &&
            isAnimating && (
              <path
                d={pathD(selectedDisplayFlight.paths.standard)}
                fill="none"
                stroke={discColor}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
                pointerEvents="none"
                className="chart-svg-path"
              />
            )}

          {displayFlights.map((flight) => {
            const std = flight.paths.standard;
            const d = pathD(std);

            return (
              <path
                key={`hit-${flight.disc.id}`}
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={HIT_STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectDisc(flight.disc.id);
                }}
              />
            );
          })}
        </svg>
      </div>

      <AnimatePresence>
        {showDetailLayers && selectedFlight && (
          <Motion.div
            key="flight-legend"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex flex-wrap justify-center gap-4 my-2 px-1"
            role="group"
            aria-label="Selected disc flight chart legend"
          >
            <div className="flex items-center gap-1.5">
              <svg width={24} height={12} viewBox="0 0 24 12" className="shrink-0 chart-svg-path">
                <line x1={0} y1={6} x2={24} y2={6} stroke={discColor} strokeWidth={3} strokeLinecap="round" />
              </svg>
              <span className="text-[11px]" style={{ color: 'var(--chart-legend-text)' }}>
                Your throw
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={24} height={12} viewBox="0 0 24 12" className="shrink-0 chart-svg-path">
                <line
                  x1={0}
                  y1={6}
                  x2={24}
                  y2={6}
                  stroke={discColor}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeOpacity="var(--chart-variant-opacity)"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[11px]" style={{ color: 'var(--chart-legend-text)' }}>
                More power
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={24} height={12} viewBox="0 0 24 12" className="shrink-0 chart-svg-path">
                <line
                  x1={0}
                  y1={6}
                  x2={24}
                  y2={6}
                  stroke={discColor}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeOpacity="var(--chart-variant-opacity)"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[11px]" style={{ color: 'var(--chart-legend-text)' }}>
                Less power
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="shrink-0 rounded-[2px] w-6 h-3 flight-chart-themed"
                style={{
                  backgroundColor: discColor,
                  opacity: 'var(--chart-envelope-opacity)',
                }}
              />
              <span className="text-[11px]" style={{ color: 'var(--chart-legend-text)' }}>
                Flight range
              </span>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {hintPhase !== 'gone' && (
        <Motion.p
          key={hintPhase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center text-[12px] italic my-2 flight-chart-themed"
          style={{ color: 'var(--chart-hint-text)' }}
        >
          {hintPhase === 'initial'
            ? 'Tap a disc to see its detailed flight'
            : 'Tap again to deselect'}
        </Motion.p>
      )}
      {hintPhase === 'gone' && <div className="my-2 h-[18px]" aria-hidden />}

      <div
        ref={chipScrollRef}
        className="flex flex-nowrap overflow-x-auto overflow-y-hidden py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden justify-start"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {displayFlights.map((flight) => {
          const sel = discIdsEqual(selectedDiscId, flight.disc.id);
          const overspeed = flight.effective.isOverspeed;
          const bounce = discIdsEqual(bounceChipId, flight.disc.id);
          return (
            <Motion.button
              key={flight.disc.id}
              type="button"
              ref={(el) => {
                chipRefs.current[String(flight.disc.id)] = el;
              }}
              aria-pressed={sel}
              aria-label={`${flight.disc.name}, speed ${flight.disc.speed}`}
              title={overspeed ? discWarnings.get(flight.disc.id) ?? undefined : undefined}
              onClick={() => selectDisc(flight.disc.id)}
              animate={bounce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={[
                'no-hover-scale group shrink-0 flex items-center gap-1.5 min-h-[44px] pl-2.5 pr-3.5 py-1.5 rounded-[20px] cursor-pointer mr-2 border border-solid',
                'transition-all duration-[120ms] ease-out max-[319px]:text-[11px]',
                'active:scale-[0.97] active:duration-60 hover:scale-[1.03]',
                sel ? 'font-bold' : 'hover:bg-[var(--chart-chip-hover-bg)] hover:border-[var(--chart-chip-hover-border)]',
                !sel ? 'active:bg-[var(--chart-chip-press-bg)]' : '',
              ].join(' ')}
              style={
                sel
                  ? {
                      backgroundColor: hexToRgba(flight.color, 0.2),
                      borderColor: hexToRgba(flight.color, 0.6),
                      borderWidth: '1.5px',
                      color: 'var(--chart-title-text)',
                      boxShadow: 'var(--chart-chip-shadow)',
                    }
                  : {
                      backgroundColor: 'var(--chart-chip-bg)',
                      borderColor: 'var(--chart-chip-border)',
                      color: overspeed ? 'var(--chart-muted-text)' : 'var(--chart-chip-text)',
                      boxShadow: 'var(--chart-chip-shadow)',
                    }
              }
            >
              <Motion.span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: flight.color }}
                whileHover={!sel ? { scale: [1, 1.4, 1] } : undefined}
                transition={{ duration: 0.3 }}
              />
              <span className="whitespace-nowrap text-[13px] font-medium max-[319px]:text-[11px]">
                {flight.disc.name}
              </span>
              <span
                className="text-[12px] tabular-nums flex items-center gap-0.5"
                style={{ color: overspeed ? 'var(--chart-muted-text)' : 'var(--chart-chip-speed)' }}
              >
                {flight.disc.speed}
                {overspeed && (
                  <span className="text-[10px]" style={{ color: 'var(--chart-warning)' }} aria-hidden>
                    ⚠
                  </span>
                )}
              </span>
            </Motion.button>
          );
        })}
      </div>
    </div>
  );
}
