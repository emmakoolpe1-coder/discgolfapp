import test from 'node:test';
import assert from 'node:assert/strict';
import { getPreloadDiscSyncBlockReason } from './firestoreSyncGuards.js';

test('blocks empty preload disc sync when Firestore has discs', () => {
  const reason = getPreloadDiscSyncBlockReason(0, 3, false);
  assert.match(reason, /Refusing to write 0 discs/);
});

test('blocks preload disc sync that would reduce Firestore disc count', () => {
  const reason = getPreloadDiscSyncBlockReason(2, 3, false);
  assert.match(reason, /Refusing to write 2 discs/);
});

test('allows post-load disc deletion syncs', () => {
  assert.equal(getPreloadDiscSyncBlockReason(2, 3, true), null);
  assert.equal(getPreloadDiscSyncBlockReason(0, 3, true), null);
});

test('allows preload sync when local count is not lower than Firestore', () => {
  assert.equal(getPreloadDiscSyncBlockReason(3, 3, false), null);
  assert.equal(getPreloadDiscSyncBlockReason(4, 3, false), null);
});
