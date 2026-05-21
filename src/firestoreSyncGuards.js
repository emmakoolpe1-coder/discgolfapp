export function shouldBlockDiscSync({ localDiscCount, remoteDiscCount, dataLoaded }) {
  if (dataLoaded) return false;
  return remoteDiscCount > 0 && localDiscCount < remoteDiscCount;
}
