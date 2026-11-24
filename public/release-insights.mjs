export const COMPENSATION_BINS = Object.freeze(['<4', '4-<6', '6-<8', '8-<10', '10-<15', '15-<20', '20+']);

export function histogramFacts(counts) {
  if (!Array.isArray(counts) || counts.length !== COMPENSATION_BINS.length ||
      Array.from(counts).some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Expected seven nonnegative histogram counts.');
  }
  const total = counts.reduce((sum, count) => sum + BigInt(count), 0n);

  function percentile(numerator, denominator) {
    if (total === 0n) return null;
    const rank = (numerator * total + denominator - 1n) / denominator;
    let running = 0n;
    return counts.findIndex((count) => {
      running += BigInt(count);
      return running >= rank;
    });
  }

  const max = Math.max(...counts);
  return {
    total: total.toString(),
    median: percentile(1n, 2n),
    p90: percentile(9n, 10n),
    peaks: max === 0 ? [] : counts.flatMap((count, index) => count === max ? [index] : []),
  };
}

export function describeHistogram(counts) {
  const facts = histogramFacts(counts);
  const bin = (index) => index === null ? 'Unavailable' : `${COMPENSATION_BINS[index]} lakh`;
  return [
    ['Sum of displayed bins', facts.total],
    ['Approximate median band', bin(facts.median)],
    ['Approximate 90th-percentile band', bin(facts.p90)],
    ['Most populated bands', facts.peaks.map(bin).join(', ') || 'Unavailable'],
  ];
}
