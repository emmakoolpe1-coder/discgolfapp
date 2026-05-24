function normalizeIdSet(ids) {
  return new Set(
    (ids || [])
      .map((id) => (id == null ? '' : String(id)))
      .filter(Boolean)
  );
}

function planRemoteDocumentSync({ localIds: incomingLocalIds, remoteIds: incomingRemoteIds, allowDeletes = false, blockedReason }) {
  const localIds = normalizeIdSet(incomingLocalIds);
  const remoteIds = normalizeIdSet(incomingRemoteIds);
  const remoteIdsMissingLocally = [...remoteIds].filter((id) => !localIds.has(id));

  if (remoteIdsMissingLocally.length > 0 && !allowDeletes) {
    return {
      blocked: true,
      reason: blockedReason,
      remoteIdsMissingLocally,
      remoteCount: remoteIds.size,
      localCount: localIds.size,
      idsToDelete: [],
    };
  }

  return {
    blocked: false,
    reason: null,
    remoteIdsMissingLocally,
    remoteCount: remoteIds.size,
    localCount: localIds.size,
    idsToDelete: remoteIdsMissingLocally,
  };
}

export function planDiscSync({ localDiscIds, remoteDiscIds, allowDiscDeletions = false } = {}) {
  return planRemoteDocumentSync({
    localIds: localDiscIds,
    remoteIds: remoteDiscIds,
    allowDeletes: allowDiscDeletions,
    blockedReason: 'remote-disc-delete-not-allowed',
  });
}

export function planAceSync({ localAceIds, remoteAceIds, allowAceDeletions = false } = {}) {
  return planRemoteDocumentSync({
    localIds: localAceIds,
    remoteIds: remoteAceIds,
    allowDeletes: allowAceDeletions,
    blockedReason: 'remote-ace-delete-not-allowed',
  });
}
