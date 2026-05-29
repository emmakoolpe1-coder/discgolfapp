export function mergeById(remote = [], local = [], idKey = 'id') {
  const remoteItems = Array.isArray(remote) ? remote : [];
  const localItems = Array.isArray(local) ? local : [];
  const remoteIds = new Set(remoteItems.map((item) => item && item[idKey]).filter(Boolean));
  return [
    ...remoteItems,
    ...localItems.filter((item) => item && item[idKey] && !remoteIds.has(item[idKey])),
  ];
}

export function mergeRemoteAndLocalData(remoteData = {}, localState = {}) {
  return {
    discs: mergeById(remoteData?.discs, localState?.discs),
    bags: mergeById(remoteData?.bags, localState?.bags),
    aceHistory: mergeById(remoteData?.aceHistory, localState?.aceHistory),
    tournaments: mergeById(remoteData?.tournaments, localState?.tournaments),
    longestThrows: mergeById(remoteData?.longestThrows, localState?.longestThrows),
    personalBests: mergeById(remoteData?.personalBests, localState?.personalBests),
  };
}
