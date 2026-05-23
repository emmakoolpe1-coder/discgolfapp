export function shouldBlockDiscSync(localDiscCount, remoteDiscCount, dataLoaded = false) {
  const localCount = Number.isFinite(localDiscCount) ? localDiscCount : 0;
  const remoteCount = Number.isFinite(remoteDiscCount) ? remoteDiscCount : 0;

  return !dataLoaded && remoteCount > 0 && localCount < remoteCount;
}
