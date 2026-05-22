import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeFirestoreProfileIntoAuth } from './profileFields.js';

test('Firestore profile merge preserves local throw style when remote field is missing', () => {
  const localAuth = {
    type: 'email',
    email: 'player@example.com',
    displayName: 'Player',
    skillLevel: 'advanced',
    throwStyle: 'lhfh',
  };

  assert.deepEqual(
    mergeFirestoreProfileIntoAuth(localAuth, { skillLevel: 'beginner' }),
    {
      ...localAuth,
      skillLevel: 'beginner',
    }
  );
});

test('Firestore profile merge applies valid remote throw style', () => {
  const localAuth = {
    type: 'email',
    email: 'player@example.com',
    displayName: 'Player',
    skillLevel: 'intermediate',
    throwStyle: 'lhfh',
  };

  assert.deepEqual(
    mergeFirestoreProfileIntoAuth(localAuth, { throwStyle: 'rhfh' }),
    {
      ...localAuth,
      throwStyle: 'rhfh',
    }
  );
});

test('Firestore profile merge ignores invalid remote throw style', () => {
  const localAuth = {
    type: 'email',
    email: 'player@example.com',
    displayName: 'Player',
    skillLevel: 'intermediate',
    throwStyle: 'lhbh',
  };

  assert.deepEqual(
    mergeFirestoreProfileIntoAuth(localAuth, { throwStyle: 'sidearm' }),
    localAuth
  );
});
