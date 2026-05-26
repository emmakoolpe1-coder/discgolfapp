import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldBlockDiscSync } from './firestoreSyncGuards.js';

test('blocks pre-load syncs that omit existing remote discs', () => {
  assert.equal(
    shouldBlockDiscSync({
      dataLoaded: false,
      incomingDiscs: [{ id: 'local-only' }],
      remoteDiscIds: ['remote-existing'],
    }),
    true
  );
});

test('allows post-load syncs to intentionally delete remote discs', () => {
  assert.equal(
    shouldBlockDiscSync({
      dataLoaded: true,
      incomingDiscs: [{ id: 'kept' }],
      remoteDiscIds: ['kept', 'deleted'],
    }),
    false
  );
});

test('allows pre-load syncs that preserve all remote disc ids', () => {
  assert.equal(
    shouldBlockDiscSync({
      dataLoaded: false,
      incomingDiscs: [{ id: 'remote-existing' }, { id: 'local-new' }],
      remoteDiscIds: ['remote-existing'],
    }),
    false
  );
});
