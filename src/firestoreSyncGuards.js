export function getBlockedDiscSyncReason(discsList = [], remoteDiscIds = [], dataLoaded = false) {
  if (dataLoaded) return null;

  const remoteIds = new Set((remoteDiscIds || []).filter(Boolean).map(String));
  if (remoteIds.size === 0) return null;

  const incomingIds = new Set(
    (discsList || [])
      .map((disc) => disc?.id)
      .filter(Boolean)
      .map(String)
  );
  const missingRemoteIds = [...remoteIds].filter((id) => !incomingIds.has(id));
  if (missingRemoteIds.length === 0) return null;

  return {
    incomingCount: incomingIds.size,
    remoteCount: remoteIds.size,
    missingRemoteIds,
  };
}
