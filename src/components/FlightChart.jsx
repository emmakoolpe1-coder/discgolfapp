import { useMemo, useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, CheckSquare, Square } from 'lucide-react';
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
import { normalizeThrowStyle } from '../firestoreSync.js';

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

const SKILL_OPTIONS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

function defaultPairModeFromThrowStyle(ts) {
  const t = normalizeThrowStyle(ts) ?? 'rhbh';
  if (t === 'rhfh' || t === 'lhbh') return 'mirrored';
  return 'standard';
}

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
 * @param {{ bagDiscs: any[], defaultSkillLevel?: 'beginner' | 'intermediate' | 'advanced', defaultThrowStyle?: string }} props
 */
export default function FlightChart({ bagDiscs, defaultSkillLevel = 'intermediate', defaultThrowStyle }) {
  const chartH = useNarrowChartHeight();
  const effectiveChartMode = useChartEffectiveTheme();
  const chartableDiscs = useMemo(
    () => (bagDiscs ?? []).filter(hasValidFlightNumbersForChart),
    [bagDiscs]
  );
  const [pairMode, setPairMode] = useState(() => defaultPairModeFromThrowStyle(defaultThrowStyle));
  useEffect(() => {
    setPairMode(defaultPairModeFromThrowStyle(defaultThrowStyle));
  }, [defaultThrowStyle]);
  const resolvedDefault =
    defaultSkillLevel === 'beginner' || defaultSkillLevel === 'intermediate' || defaultSkillLevel === 'advanced'
      ? defaultSkillLevel
      : 'intermediate';
  const [skillLevel, setSkillLevel] = useState(resolvedDefault);
  useEffect(() => {
    setSkillLevel(resolvedDefault);
  }, [resolvedDefault]);
  /** One disc emphasized on the chart; null = all paths shown with equal weight. */
  const [highlightedDiscId, setHighlightedDiscId] = useState(/** @type {string | null} */ (null));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const discPickerTriggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const [discPickerMenuRect, setDiscPickerMenuRect] = useState(
    /** @type {{ top: number; left: number; width: number } | null} */ (null)
  );
  const userInteractedRef = useRef(false);
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

  /** Envelope / power paths use this mirror flag; "both" uses standard for envelope. */
  const mirror = pairMode === 'mirrored';

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

  const manufacturerByDiscId = useMemo(() => {
    const m = new Map();
    for (const d of chartableDiscs) {
      const raw = d.manufacturer != null ? String(d.manufacturer).trim() : '';
      m.set(String(d.id), raw || '\u2014');
    }
    return m;
  }, [chartableDiscs]);

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

  const dataStandard = useMemo(() => {
    if (!definitions.length) {
      return {
        flights: /** @type {import('../flightChartMath.js').DiscFlightData[]} */ ([]),
        maxDistance: 400,
        maxLateral: 30,
        discWarnings: /** @type {Map<string, string>} */ (new Map()),
      };
    }
    return generateBagFlightData(definitions, skillLevel, false);
  }, [definitions, skillLevel]);

  const dataMirrored = useMemo(() => {
    if (!definitions.length) {
      return {
        flights: /** @type {import('../flightChartMath.js').DiscFlightData[]} */ ([]),
        maxDistance: 400,
        maxLateral: 30,
        discWarnings: /** @type {Map<string, string>} */ (new Map()),
      };
    }
    return generateBagFlightData(definitions, skillLevel, true);
  }, [definitions, skillLevel]);

  const { flights, mirrorFlights, maxDistance, maxLateral, discWarnings } = useMemo(() => {
    if (!definitions.length) {
      return {
        flights: [],
        mirrorFlights: null,
        maxDistance: 400,
        maxLateral: 30,
        discWarnings: /** @type {Map<string, string>} */ (new Map()),
      };
    }
    if (pairMode === 'both') {
      return {
        flights: dataStandard.flights,
        mirrorFlights: dataMirrored.flights,
        maxDistance: Math.max(dataStandard.maxDistance, dataMirrored.maxDistance),
        maxLateral: Math.max(dataStandard.maxLateral, dataMirrored.maxLateral),
        discWarnings: dataStandard.discWarnings,
      };
    }
    const data = pairMode === 'mirrored' ? dataMirrored : dataStandard;
    return {
      flights: data.flights,
      mirrorFlights: null,
      maxDistance: data.maxDistance,
      maxLateral: data.maxLateral,
      discWarnings: data.discWarnings,
    };
  }, [pairMode, dataStandard, dataMirrored]);

  const mirrorFlightsById = useMemo(() => {
    if (!mirrorFlights) return null;
    const m = new Map();
    for (const f of mirrorFlights) {
      m.set(String(f.disc.id), f);
    }
    return m;
  }, [mirrorFlights]);

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

  /** Clear highlight if that disc is no longer in the bag. */
  useEffect(() => {
    if (!chartableDiscs.length) {
      queueMicrotask(() => setHighlightedDiscId(null));
      return;
    }
    queueMicrotask(() => {
      setHighlightedDiscId((prev) =>
        hasSelectedDiscId(prev) && !chartableDiscs.some((d) => discIdsEqual(d.id, prev)) ? null : prev
      );
    });
  }, [chartableDiscs]);

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
    [chartH, displayMaxLateral, displayMaxDistance]
  );

  const primaryId = highlightedDiscId;

  const selectedFlight = useMemo(
    () => flights.find((f) => discIdsEqual(f.disc.id, primaryId)) ?? null,
    [flights, primaryId]
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
  const showDetailLayers = hasSelectedDiscId(primaryId) && !isAnimating;

  const selectedDisplayFlight = useMemo(
    () => displayFlights.find((f) => discIdsEqual(f.disc.id, primaryId)) ?? null,
    [displayFlights, primaryId]
  );

  const selectedMirroredDisplayFlight = useMemo(() => {
    if (pairMode !== 'both' || !mirrorFlightsById || !hasSelectedDiscId(primaryId) || isAnimating) return null;
    return mirrorFlightsById.get(String(primaryId)) ?? null;
  }, [pairMode, mirrorFlightsById, primaryId, isAnimating]);

  const finishHintForever = useCallback(() => {
    try {
      localStorage.setItem(HINT_KEY, 'true');
    } catch {
      /* ignore */
    }
    setHintPhase('gone');
  }, []);

  const closeDiscPicker = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  const toggleHighlight = useCallback(
    (id) => {
      userInteractedRef.current = true;
      closeDiscPicker();
      setHighlightedDiscId((prev) => {
        if (discIdsEqual(prev, id)) {
          queueMicrotask(finishHintForever);
          return null;
        }
        queueMicrotask(() => {
          setHintPhase((h) => (h === 'initial' ? 'second' : h));
        });
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        return String(id);
      });
    },
    [finishHintForever, closeDiscPicker]
  );

  useLayoutEffect(() => {
    if (!dropdownOpen || !discPickerTriggerRef.current) return;
    const el = discPickerTriggerRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDiscPickerMenuRect({ top: r.bottom + 8, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [dropdownOpen]);

  const onChartBgClick = useCallback(() => {
    closeDiscPicker();
  }, [closeDiscPicker]);

  const skillLabel = SKILL_PROFILES[skillLevel]?.label ?? skillLevel;
  const pairLabel =
    pairMode === 'both'
      ? 'RHBH/LHFH and RHFH/LHBH overlay'
      : pairMode === 'mirrored'
        ? 'RHFH/LHBH'
        : 'RHBH/LHFH';

  const svgAria = useMemo(() => {
    const n = displayFlights.length;
    return `Bag flight chart showing ${n} disc${n !== 1 ? 's' : ''} at ${skillLabel} level, ${pairLabel} view`;
  }, [displayFlights.length, skillLabel, pairLabel]);

  const discPickerSummary = useMemo(() => {
    const total = displayFlights.length;
    if (total === 0) return 'Highlight a disc';
    if (!hasSelectedDiscId(highlightedDiscId)) {
      return `All ${total} disc${total !== 1 ? 's' : ''} shown`;
    }
    const f = displayFlights.find((x) => discIdsEqual(x.disc.id, highlightedDiscId));
    return f ? `Highlighting: ${f.disc.name}` : 'Highlight a disc';
  }, [highlightedDiscId, displayFlights]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dropdownOpen]);

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
        <legend className="sr-only">Flight path view</legend>
        <div
          className="flex w-full gap-0.5 rounded-[18px] overflow-hidden p-0.5 min-h-[36px] flight-chart-themed"
          style={{ backgroundColor: 'var(--chart-toggle-bg)' }}
          role="radiogroup"
          aria-label="Flight path view"
        >
          {[
            { id: 'standard', label: 'RHBH / LHFH' },
            { id: 'both', label: 'Both' },
            { id: 'mirrored', label: 'RHFH / LHBH' },
          ].map(({ id, label }) => {
            const selected = pairMode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPairMode(id)}
                className="no-hover-scale flex-1 min-h-[36px] min-w-0 px-1 rounded-2xl text-[10px] sm:text-[11px] font-bold leading-tight transition-colors duration-200 ease-out flight-chart-themed"
                style={
                  selected
                    ? {
                        backgroundColor: 'var(--chart-toggle-active-bg)',
                        color: 'var(--chart-toggle-active-text)',
                      }
                    : { backgroundColor: 'transparent', color: 'var(--chart-toggle-inactive-text)' }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {pairMode === 'both' && (
        <div
          className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-2 px-1"
          role="note"
          aria-label="Overlaid paths: solid line is RHBH and LHFH; dashed line is RHFH and LHBH"
        >
          <div className="flex items-center gap-1.5">
            <svg width={24} height={10} viewBox="0 0 24 10" className="shrink-0 chart-svg-path" aria-hidden>
              <line x1={0} y1={5} x2={24} y2={5} stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-semibold flight-chart-themed" style={{ color: 'var(--chart-legend-text)' }}>
              RHBH / LHFH
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width={24} height={10} viewBox="0 0 24 10" className="shrink-0 chart-svg-path" aria-hidden>
              <line x1={0} y1={5} x2={24} y2={5} stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-semibold flight-chart-themed" style={{ color: 'var(--chart-legend-text)' }}>
              RHFH / LHBH
            </span>
          </div>
        </div>
      )}

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
          onClick={onChartBgClick}
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

          {/* Layer 2: all discs at equal weight, or dimmed non-highlighted when one disc is emphasized */}
          {displayFlights.map((flight) => {
            if (hasSelectedDiscId(highlightedDiscId) && discIdsEqual(flight.disc.id, highlightedDiscId)) return null;
            const std = flight.paths.standard;
            const d = pathD(std);
            const overview = highlightedDiscId == null;
            const strokeW = overview ? 2.5 : 1.5;
            const mirF = pairMode === 'both' && mirrorFlightsById ? mirrorFlightsById.get(String(flight.disc.id)) : null;

            return (
              <g key={`line-group-${flight.disc.id}`}>
                <path
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
                {mirF && (
                  <path
                    d={pathD(mirF.paths.standard)}
                    fill="none"
                    stroke={flight.color}
                    strokeWidth={strokeW}
                    strokeDasharray="5 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="chart-svg-path"
                    pointerEvents="none"
                    style={{
                      opacity: overview ? 'var(--chart-path-opacity-default)' : 'var(--chart-path-dimmed)',
                      transition: 'opacity 250ms ease, stroke-width 250ms ease, stroke 200ms ease',
                    }}
                  />
                )}
              </g>
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
                {selectedMirroredDisplayFlight && (
                  <path
                    d={pathD(selectedMirroredDisplayFlight.paths.standard)}
                    fill="none"
                    stroke={discColor}
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={0.9}
                    className="chart-svg-path"
                  />
                )}
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
          {hasSelectedDiscId(primaryId) &&
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
                  toggleHighlight(flight.disc.id);
                }}
              />
            );
          })}
        </svg>
      </div>

      <div className="relative mt-3">
        <button
          ref={discPickerTriggerRef}
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          className="no-hover-scale flex w-full min-h-[44px] items-center justify-between gap-2 rounded-2xl border border-solid px-3 py-2.5 text-left text-[13px] font-medium transition-colors flight-chart-themed"
          style={{
            backgroundColor: 'var(--chart-chip-bg)',
            borderColor: 'var(--chart-chip-border)',
            color: 'var(--chart-title-text)',
            boxShadow: 'var(--chart-chip-shadow)',
          }}
        >
          <span className="min-w-0 truncate">{discPickerSummary}</span>
          <ChevronDown
            className={`shrink-0 w-[18px] h-[18px] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--chart-muted-text)' }}
            aria-hidden
          />
        </button>
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
            ? 'Use the disc picker below the chart to highlight one flight'
            : 'Uncheck the box or tap the path again to show all discs equally'}
        </Motion.p>
      )}
      {hintPhase === 'gone' && <div className="my-2 h-[18px]" aria-hidden />}

      {typeof document !== 'undefined' &&
        dropdownOpen &&
        discPickerMenuRect &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[1000]"
              style={{ backgroundColor: 'transparent' }}
              onClick={closeDiscPicker}
              aria-hidden
            />
            <div
              className="fixed z-[1001] flex max-h-[60vh] flex-col overflow-hidden rounded-2xl border border-solid box-border flight-chart-themed md:max-h-[min(80vh,560px)]"
              style={{
                top: discPickerMenuRect.top,
                left: Math.max(12, discPickerMenuRect.left),
                width: Math.min(
                  discPickerMenuRect.width,
                  typeof window !== 'undefined' ? window.innerWidth - 24 : discPickerMenuRect.width
                ),
                maxWidth: 'min(100vw - 1.5rem, 500px)',
                backgroundColor: 'var(--chart-card-bg)',
                borderColor: 'var(--chart-card-border)',
                boxShadow: 'var(--chart-chip-shadow)',
              }}
              role="listbox"
              aria-multiselectable="false"
              aria-label="Discs on flight chart"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1">
                {displayFlights.map((flight) => {
                  const isHighlighted =
                    hasSelectedDiscId(highlightedDiscId) && discIdsEqual(highlightedDiscId, flight.disc.id);
                  const overspeed = flight.effective.isOverspeed;
                  const mfr = manufacturerByDiscId.get(String(flight.disc.id)) ?? '\u2014';
                  return (
                    <button
                      key={flight.disc.id}
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      title={overspeed ? discWarnings.get(flight.disc.id) ?? undefined : undefined}
                      onClick={() => toggleHighlight(flight.disc.id)}
                      className="no-hover-scale mb-1 flex w-full min-h-[48px] items-center gap-2 rounded-xl px-2 py-2 text-left last:mb-0 active:scale-[0.99] transition-transform"
                      style={{
                        borderLeftWidth: 3,
                        borderLeftStyle: 'solid',
                        borderLeftColor: flight.color,
                        backgroundColor: isHighlighted ? 'var(--chart-chip-hover-bg)' : 'var(--chart-chip-bg)',
                      }}
                    >
                      <span className="shrink-0 flex items-center justify-center" style={{ color: flight.color }}>
                        {isHighlighted ? (
                          <CheckSquare className="h-5 w-5" strokeWidth={2} aria-hidden />
                        ) : (
                          <Square className="h-5 w-5" strokeWidth={2} aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold" style={{ color: 'var(--chart-title-text)' }}>
                          {flight.disc.name}
                        </span>
                        <span className="block truncate text-[11px]" style={{ color: 'var(--chart-muted-text)' }}>
                          {mfr}
                        </span>
                      </span>
                      <span
                        className="shrink-0 text-[11px] tabular-nums text-right whitespace-nowrap leading-snug"
                        style={{ color: overspeed ? 'var(--chart-muted-text)' : 'var(--chart-chip-speed)' }}
                      >
                        {flight.disc.speed} / {flight.disc.glide} / {flight.disc.turn} / {flight.disc.fade}
                        {overspeed && (
                          <span className="ml-0.5 text-[10px]" style={{ color: 'var(--chart-warning)' }} aria-hidden>
                            ⚠
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className="shrink-0 border-t border-solid px-3 py-2"
                style={{ borderColor: 'var(--chart-card-border)' }}
              >
                <button
                  type="button"
                  onClick={closeDiscPicker}
                  className="no-hover-scale w-full min-h-[44px] rounded-2xl text-[14px] font-bold transition-colors"
                  style={{
                    backgroundColor: 'var(--chart-toggle-active-bg)',
                    color: 'var(--chart-toggle-active-text)',
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
