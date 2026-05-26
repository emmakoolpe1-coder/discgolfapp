export function shouldBlockDiscSync({ dataLoaded, incomingDiscs, remoteDiscIds }) {
  if (dataLoaded) return false;

  const remoteIds = (remoteDiscIds ?? []).filter(Boolean);
  if (remoteIds.length === 0) return false;

  const incomingIds = new Set((incomingDiscs ?? []).map((disc) => disc?.id).filter(Boolean));
  const missingRemoteIds = remoteIds.filter((id) => !incomingIds.has(id));

  return missingRemoteIds.length > 0;
}
