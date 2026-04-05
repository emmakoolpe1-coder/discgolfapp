/**
 * Shared flight chart UI: pair modes (standard vs mirrored geometry), toggle labels,
 * and per-disc preference (primary / both / opposite).
 */
import { normalizeThrowStyle } from './firestoreSync.js';

/** @returns {'standard'|'mirrored'} */
export function primaryFlightPairMode(throwStyle) {
  const t = normalizeThrowStyle(throwStyle) ?? 'rhbh';
  if (t === 'rhfh' || t === 'lhbh') return 'mirrored';
  return 'standard';
}

/** @returns {'standard'|'mirrored'} */
export function oppositeFlightPairMode(throwStyle) {
  return primaryFlightPairMode(throwStyle) === 'mirrored' ? 'standard' : 'mirrored';
}

/** Default pair mode for a user's throwing style (first toggle = primary path). */
export function defaultPairModeFromThrowStyle(throwStyle) {
  return primaryFlightPairMode(throwStyle);
}

/**
 * Three toggle labels (fixed left → right: standard pair | Both | mirrored pair).
 * Order and text do not change with throw style; only default selection and path shape do.
 * @returns {{ primary: string, middle: string, opposite: string }}
 */
export function getFlightPathToggleLabels(_throwStyle) {
  return { primary: 'RHBH / LHFH', middle: 'Both', opposite: 'RHFH / LHBH' };
}

/** Solid = standard (RHBH/LHFH); dashed = mirrored (RHFH/LHBH) for "Both" overlay legend. */
export function getBothModeLegendLabels(_throwStyle) {
  return {
    solidLineLabel: 'RHBH / LHFH',
    dashedLineLabel: 'RHFH / LHBH',
  };
}

/** @param {'primary'|'both'|'opposite'|null|undefined} pref */
export function pairModeFromPreference(pref, throwStyle) {
  if (pref === 'both') return 'both';
  if (pref === 'opposite') return oppositeFlightPairMode(throwStyle);
  return primaryFlightPairMode(throwStyle);
}

/** Migrate legacy bh/fh and normalize stored preference. */
export function normalizeFlightPreference(f) {
  if (f === 'bh' || f === 'primary') return 'primary';
  if (f === 'fh' || f === 'opposite') return 'opposite';
  if (f === 'both') return 'both';
  return 'primary';
}

/**
 * After global throw style changes from old → new, rewrite stored flight_preference so the
 * chart still shows the same path geometry (standard / mirrored / both) as before.
 * Use when the user declines bulk-updating all discs to `primary`.
 */
export function preserveFlightPreferenceAcrossThrowStyleChange(oldPref, oldThrowStyle, newThrowStyle) {
  const oldNorm = normalizeFlightPreference(oldPref);
  const oldPm = pairModeFromPreference(oldNorm, oldThrowStyle);
  if (oldPm === 'both') return 'both';
  const primaryNew = primaryFlightPairMode(newThrowStyle);
  if (oldPm === 'standard') {
    return primaryNew === 'standard' ? 'primary' : 'opposite';
  }
  if (oldPm === 'mirrored') {
    return primaryNew === 'mirrored' ? 'primary' : 'opposite';
  }
  return 'primary';
}

export function userDominantHandLabel(throwStyle) {
  const t = normalizeThrowStyle(throwStyle) ?? 'rhbh';
  if (t === 'lhbh' || t === 'lhfh') return 'Left Hand';
  return 'Right Hand';
}

/**
 * Short description for a11y / chart subtitle.
 * @param {'standard'|'mirrored'|'both'} pairMode
 */
export function getPairLabelForAria(pairMode, _throwStyle) {
  const primary = 'RHBH / LHFH';
  const opposite = 'RHFH / LHBH';
  if (pairMode === 'both') return `${primary} and ${opposite} overlay`;
  if (pairMode === 'standard') return primary;
  if (pairMode === 'mirrored') return opposite;
  return String(pairMode);
}
