export const batchLimits = Object.freeze({ min: 30, max: 500 });
export const windowLimits = Object.freeze({ min: 1, max: 168 });

/** @typedef {{ minimumBatch: number, windowHours: number }} FixturePolicy */

/**
 * @param {unknown} value
 * @param {{ min: number, max: number }} limits
 * @returns {value is number}
 */
export function isWithinLimits(value, limits) {
  return typeof value === 'number' && Number.isInteger(value) &&
    value >= limits.min && value <= limits.max;
}

/**
 * Validate the two public settings accepted by the isolated fixture.
 * @param {unknown} value
 * @returns {FixturePolicy | null}
 */
export function readFixturePolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 2 || !('minimumBatch' in value) || !('windowHours' in value)) {
    return null;
  }
  const { minimumBatch, windowHours } = value;
  if (!isWithinLimits(minimumBatch, batchLimits) || !isWithinLimits(windowHours, windowLimits)) return null;
  return { minimumBatch, windowHours };
}
