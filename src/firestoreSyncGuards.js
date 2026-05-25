function normalizeIdList(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter(Boolean).map(String))];
}

export function getDiscSyncBlockReason({ incomingDiscIds, remoteDiscIds, dataLoaded }) {
  if (dataLoaded) return null;

  const incoming = new Set(normalizeIdList(incomingDiscIds));
  const remote = normalizeIdList(remoteDiscIds);
  if (remote.length === 0) return null;

  const missingRemoteIds = remote.filter((id) => !incoming.has(id));
  if (missingRemoteIds.length === 0) return null;

  if (incoming.size === 0) {
    return `Refusing to write 0 discs when Firestore has ${remote.length} discs. Possible data loss prevented.`;
  }

  return `Refusing to write local disc state that omits ${missingRemoteIds.length} of ${remote.length} Firestore discs. Possible data loss prevented.`;
}
