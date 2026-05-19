/**
 * Startup sync safety checks.
 *
 * Before Firestore has loaded, local state can temporarily be empty/default.
 * Once the app has loaded remote data, lower counts are intentional deletions
 * and must be allowed to persist.
 */
export function getPreloadDiscSyncBlockReason(localDiscCount, remoteDiscCount, dataLoaded) {
  if (dataLoaded) return null;
  if (localDiscCount === 0 && remoteDiscCount > 0) {
    return `Refusing to write 0 discs when Firestore has ${remoteDiscCount} discs. Possible data loss prevented.`;
  }
  if (localDiscCount < remoteDiscCount) {
    return `Refusing to write ${localDiscCount} discs when Firestore has ${remoteDiscCount}. Possible data loss prevented.`;
  }
  return null;
}
