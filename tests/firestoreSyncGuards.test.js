import test from 'node:test';
import assert from 'node:assert/strict';

import { getDiscSyncBlockReason } from '../src/firestoreSyncGuards.js';

test('blocks pre-load empty disc writes over existing Firestore discs', () => {
  const reason = getDiscSyncBlockReason({
    incomingDiscIds: [],
    remoteDiscIds: ['remote-disc'],
    dataLoaded: false,
  });

  assert.match(reason, /Refusing to write 0 discs/);
});

test('blocks pre-load writes that omit any existing Firestore disc id', () => {
  const reason = getDiscSyncBlockReason({
    incomingDiscIds: ['disc-a', 'new-local-disc'],
    remoteDiscIds: ['disc-a', 'disc-b'],
    dataLoaded: false,
  });

  assert.match(reason, /omits 1 of 2 Firestore discs/);
});

test('blocks pre-load writes even when local and remote counts match but ids differ', () => {
  const reason = getDiscSyncBlockReason({
    incomingDiscIds: ['disc-a', 'disc-c'],
    remoteDiscIds: ['disc-a', 'disc-b'],
    dataLoaded: false,
  });

  assert.match(reason, /omits 1 of 2 Firestore discs/);
});

test('allows intentional post-load disc deletions', () => {
  const reason = getDiscSyncBlockReason({
    incomingDiscIds: ['disc-a'],
    remoteDiscIds: ['disc-a', 'disc-b'],
    dataLoaded: true,
  });

  assert.equal(reason, null);
});

test('allows pre-load writes when Firestore has no existing discs', () => {
  const reason = getDiscSyncBlockReason({
    incomingDiscIds: ['first-disc'],
    remoteDiscIds: [],
    dataLoaded: false,
  });

  assert.equal(reason, null);
});
