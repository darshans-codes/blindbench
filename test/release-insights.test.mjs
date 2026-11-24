import assert from 'node:assert/strict';
import test from 'node:test';
import { describeHistogram, histogramFacts } from '../public/release-insights.mjs';

test('summary facts are calculated solely from displayed histogram bins', () => {
  const counts = [3, 8, 14, 22, 18, 11, 6];
  assert.deepEqual(histogramFacts(counts), { total: '82', median: 3, p90: 5, peaks: [3] });
  assert.deepEqual(histogramFacts([0, 1, 0, 1, 0, 0, 1]), { total: '3', median: 3, p90: 6, peaks: [1, 3, 6] });
  assert.deepEqual(histogramFacts(Array(7).fill(0)), { total: '0', median: null, p90: null, peaks: [] });
  assert.deepEqual(histogramFacts(Array(7).fill(Number.MAX_SAFE_INTEGER)), {
    total: '63050394783186937', median: 3, p90: 6, peaks: [0, 1, 2, 3, 4, 5, 6],
  });
  assert.equal(describeHistogram(counts)[1][1], '8-<10 lakh');
});

test('summary rejects missing, sparse, signed or non-integer values', () => {
  for (const input of [null, [], Array(7), Array(7).fill(-1), Array(7).fill(1.5), Array(7).fill('1')]) {
    assert.throws(() => histogramFacts(input));
  }
});
