import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldBlockDiscSync } from './firestoreSyncGuards.js';

test('blocks pre-load empty disc sync when Firestore has discs', () => {
  assert.equal(
    shouldBlockDiscSync({ localDiscCount: 0, remoteDiscCount: 3, dataLoaded: false }),
    true,
  );
});

test('allows post-load disc deletes to sync', () => {
  assert.equal(
    shouldBlockDiscSync({ localDiscCount: 2, remoteDiscCount: 3, dataLoaded: true }),
    false,
  );
});

test('allows post-load deletion of the final disc', () => {
  assert.equal(
    shouldBlockDiscSync({ localDiscCount: 0, remoteDiscCount: 1, dataLoaded: true }),
    false,
  );
});
