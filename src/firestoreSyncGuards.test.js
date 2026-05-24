import assert from 'node:assert/strict';
import test from 'node:test';
import { planAceSync, planDiscSync } from './firestoreSyncGuards.js';

test('blocks remote disc deletion when deletion has not been explicitly allowed', () => {
  const plan = planDiscSync({
    localDiscIds: ['local-a', 'local-b', 'local-c'],
    remoteDiscIds: ['remote-a', 'remote-b'],
    allowDiscDeletions: false,
  });

  assert.equal(plan.blocked, true);
  assert.equal(plan.reason, 'remote-disc-delete-not-allowed');
  assert.deepEqual(plan.remoteIdsMissingLocally, ['remote-a', 'remote-b']);
  assert.deepEqual(plan.idsToDelete, []);
});

test('allows intentional post-load disc deletions', () => {
  const plan = planDiscSync({
    localDiscIds: ['kept-disc'],
    remoteDiscIds: ['kept-disc', 'deleted-disc'],
    allowDiscDeletions: true,
  });

  assert.equal(plan.blocked, false);
  assert.deepEqual(plan.idsToDelete, ['deleted-disc']);
});

test('allows safe additions without deleting remote discs', () => {
  const plan = planDiscSync({
    localDiscIds: ['remote-disc', 'new-disc'],
    remoteDiscIds: ['remote-disc'],
    allowDiscDeletions: false,
  });

  assert.equal(plan.blocked, false);
  assert.deepEqual(plan.idsToDelete, []);
});

test('blocks pre-load ace deletion independently from disc deletion', () => {
  const plan = planAceSync({
    localAceIds: [],
    remoteAceIds: ['ace-1'],
    allowAceDeletions: false,
  });

  assert.equal(plan.blocked, true);
  assert.equal(plan.reason, 'remote-ace-delete-not-allowed');
  assert.deepEqual(plan.idsToDelete, []);
});
