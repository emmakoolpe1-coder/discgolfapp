import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldBlockDiscSync } from './firestoreSyncGuards.js';

test('blocks stale pre-load disc snapshots that would reduce cloud data', () => {
  assert.equal(shouldBlockDiscSync({ localDiscCount: 0, remoteDiscCount: 3, dataLoaded: false }), true);
  assert.equal(shouldBlockDiscSync({ localDiscCount: 2, remoteDiscCount: 3, dataLoaded: false }), true);
});

test('allows intentional post-load disc deletions to sync', () => {
  assert.equal(shouldBlockDiscSync({ localDiscCount: 0, remoteDiscCount: 3, dataLoaded: true }), false);
  assert.equal(shouldBlockDiscSync({ localDiscCount: 2, remoteDiscCount: 3, dataLoaded: true }), false);
});

test('allows disc additions and no-op syncs before load', () => {
  assert.equal(shouldBlockDiscSync({ localDiscCount: 3, remoteDiscCount: 3, dataLoaded: false }), false);
  assert.equal(shouldBlockDiscSync({ localDiscCount: 4, remoteDiscCount: 3, dataLoaded: false }), false);
});
