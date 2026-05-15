export function shouldBlockDiscSync({ localDiscCount, remoteDiscCount, dataLoaded }) {
  // Before the initial Firestore load finishes, an empty local array is likely
  // startup state. After load, smaller counts can be intentional user deletes.
  return !dataLoaded && localDiscCount === 0 && remoteDiscCount > 0;
}
