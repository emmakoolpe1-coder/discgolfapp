import test from 'node:test';
import assert from 'node:assert/strict';
import { getBlockedDiscSyncReason } from './firestoreSyncGuards.js';

test('allows intentional post-load disc deletions', () => {
  const reason = getBlockedDiscSyncReason([{ id: 'disc-a' }], ['disc-a', 'disc-b'], true);
  assert.equal(reason, null);
});

test('blocks pre-load writes that omit existing remote discs', () => {
  const reason = getBlockedDiscSyncReason(
    [{ id: 'disc-new-1' }, { id: 'disc-new-2' }, { id: 'disc-new-3' }],
    ['disc-old-1', 'disc-old-2'],
    false
  );

  assert.deepEqual(reason, {
    incomingCount: 3,
    remoteCount: 2,
    missingRemoteIds: ['disc-old-1', 'disc-old-2'],
  });
});

test('allows pre-load writes once every remote disc id is present', () => {
  const reason = getBlockedDiscSyncReason(
    [{ id: 'disc-old-1' }, { id: 'disc-old-2' }, { id: 'disc-new' }],
    ['disc-old-1', 'disc-old-2'],
    false
  );

  assert.equal(reason, null);
});
