import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRemoteAndLocalData } from './syncStateMerge.js';

test('guest migration merge preserves existing remote records and appends guest records', () => {
  const remote = {
    discs: [{ id: 'remote-disc', mold: 'Destroyer' }],
    bags: [{ id: 'remote-bag', name: 'Tournament Bag' }],
    aceHistory: [{ id: 'remote-ace', discId: 'remote-disc' }],
    tournaments: [{ id: 'remote-tournament', name: 'League' }],
    longestThrows: [{ id: 'remote-throw', distance: 350 }],
    personalBests: [{ id: 'remote-pb', category: 'Putting' }],
  };
  const guest = {
    discs: [{ id: 'guest-disc', mold: 'Envy' }],
    bags: [{ id: 'guest-bag', name: 'Practice Bag' }],
    aceHistory: [{ id: 'guest-ace', discId: 'guest-disc' }],
    tournaments: [{ id: 'guest-tournament', name: 'Flex' }],
    longestThrows: [{ id: 'guest-throw', distance: 250 }],
    personalBests: [{ id: 'guest-pb', category: 'Distance' }],
  };

  assert.deepEqual(mergeRemoteAndLocalData(remote, guest), {
    discs: [remote.discs[0], guest.discs[0]],
    bags: [remote.bags[0], guest.bags[0]],
    aceHistory: [remote.aceHistory[0], guest.aceHistory[0]],
    tournaments: [remote.tournaments[0], guest.tournaments[0]],
    longestThrows: [remote.longestThrows[0], guest.longestThrows[0]],
    personalBests: [remote.personalBests[0], guest.personalBests[0]],
  });
});

test('remote data wins when local state contains the same id', () => {
  const merged = mergeRemoteAndLocalData(
    { discs: [{ id: 'same-disc', mold: 'Remote Mold' }] },
    { discs: [{ id: 'same-disc', mold: 'Guest Mold' }] }
  );

  assert.deepEqual(merged.discs, [{ id: 'same-disc', mold: 'Remote Mold' }]);
});
