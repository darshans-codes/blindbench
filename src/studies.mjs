import { batchLimits, isWithinLimits, windowLimits } from '../packages/study-policy/index.mjs';
import { COMPENSATION_BINS } from '../public/release-insights.mjs';

export const BINS = COMPENSATION_BINS;

export const TEMPLATE = Object.freeze({
  title: 'Synthetic compensation study',
  measurement: 'Annual compensation in INR lakh',
  bins: BINS,
  epsilon: 1,
  delta: 0,
  minimumBatch: 30,
  windowHours: 24,
  adjacency: 'Add or remove one participant',
});

export const EXAMPLE_RESULT = Object.freeze([3, 8, 14, 22, 18, 11, 6]);
const titlePattern = /^[\p{L}\p{N}][\p{L}\p{N} .,’'()&–—-]{2,79}$/u;

/** @param {URLSearchParams} input */
export function validateDraft(input) {
  const title = input.get('title')?.trim() ?? '';
  const minimumBatch = input.get('minimumBatch') ?? '';
  const windowHours = input.get('windowHours') ?? '';
  const fields = { title, minimumBatch, windowHours };
  /** @type {Partial<Record<keyof typeof fields, string>>} */
  const errors = {};
  if (!titlePattern.test(title)) errors.title = 'Enter a fictional study name using 3 to 80 characters.';
  if (!/^\d{2,3}$/.test(minimumBatch) || !isWithinLimits(Number(minimumBatch), batchLimits)) {
    errors.minimumBatch = 'Enter a whole number from 30 to 500.';
  }
  if (!/^\d{1,3}$/.test(windowHours) || !isWithinLimits(Number(windowHours), windowLimits)) {
    errors.windowHours = 'Enter a whole number from 1 to 168 hours.';
  }
  return { fields, errors, draft: { title, minimumBatch: Number(minimumBatch), windowHours: Number(windowHours) } };
}
