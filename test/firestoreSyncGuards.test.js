import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldBlockDiscSync } from '../src/firestoreSyncGuards.js';

describe('shouldBlockDiscSync', () => {
  it('blocks stale pre-load local state from reducing remote discs', () => {
    assert.equal(shouldBlockDiscSync(0, 2, false), true);
    assert.equal(shouldBlockDiscSync(1, 2, false), true);
  });

  it('allows intentional post-load disc deletions', () => {
    assert.equal(shouldBlockDiscSync(0, 2, true), false);
    assert.equal(shouldBlockDiscSync(1, 2, true), false);
  });

  it('allows sync when local count does not reduce remote count', () => {
    assert.equal(shouldBlockDiscSync(2, 2, false), false);
    assert.equal(shouldBlockDiscSync(3, 2, false), false);
  });
});
