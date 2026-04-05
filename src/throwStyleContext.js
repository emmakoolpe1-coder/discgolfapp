import { createContext, useContext } from 'react';
import { normalizeThrowStyle } from './firestoreSync.js';

/** Current user's throwing style for flight charts; update when profile or guest prefs change. */
export const ThrowStyleContext = createContext(null);

export function useThrowStyle() {
  const v = useContext(ThrowStyleContext);
  return normalizeThrowStyle(v) ?? 'rhbh';
}
