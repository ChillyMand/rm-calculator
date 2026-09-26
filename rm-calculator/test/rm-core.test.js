import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FORMULAS, calculateSet, kgToLb, lbToKg, roundWeight, validateSet } from '../rm-core.js';
import { calculateSession, MODEL_VERSION, PARAMETERS } from '../multiset-v3.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const makeSession = (count = 5, rest = 5, reps = 5) => ({
  weight: 80,
  unit: 'kg',
  exercise: 'bench_press',
  effort: 'last_near_failure',
  sets: Array.from({ length: count }, (_, index) => index === count - 1 ? { reps } : { reps, restMinutes: rest }),
});

test('single-set mode calculates eight formulas and trims extremes', () => {
  const result = calculateSet({ weight: 80, reps: 5, rir: 0 });
  assert.equal(Object.keys(result.formulas).length, 8);
  assert.equal(Object.keys(FORMULAS).length, 8);
  const values = Object.values(result.formulas).sort((a, b) => a - b);
  assert.equal(result.average, values.slice(1, -1).reduce((sum, value) => sum + value, 0) / 6);
});

test('single-set RIR increases effective reps and estimate', () => {
  const exhausted = calculateSet({ weight: 80, reps: 5, rir: 0 });
  const reserve = calculateSet({ weight: 80, reps: 5, rir: 2 });
  assert.equal(reserve.effectiveReps, 7);
  assert.ok(reserve.average > exhausted.average);
});

test('single completed rep at RIR zero is exact', () => {
  const result = calculateSet({ weight: 80, reps: 1, rir: 0 });
  assert.equal(result.average, 80);
  assert.deepEqual(result.range, { min: 80, max: 80 });
});

test('shared validation and unit utilities remain stable', () => {
  assert.deepEqual(validateSet({ weight: '', reps: 5 }), { valid: false, message: '请输入重量' });
  assert.deepEqual(validateSet({ weight: 80, reps: 31 }), { valid: false, message: '建议输入1～30次范围内的数据' });
  assert.ok(Math.abs(kgToLb(lbToKg(176.37)) - 176.37) < 0.01);
  assert.equal(roundWeight(87.3, 0.5), 87.5);
});

test('production V3 matches the published 80kg 5x5 regression', () => {
  const result = calculateSession(makeSession());
  assert.equal(result.modelVersion, MODEL_VERSION);
  near(result.estimateKg, 96.99984223003528);
  assert.equal(result.status, 'ok_experimental');
  assert.deepEqual(result.anchors, [{ index: 4, lo: 0, hi: 1, source: 'selected_near_failure_interval' }]);
  near(result.effortOnlyRangeKg[1] - result.effortOnlyRangeKg[0], 80 / PARAMETERS.k);
});

test('V3 keeps unknown RIR distinct from zero', () => {
  const planned = makeSession();
  const allFailure = makeSession();
  allFailure.effort = 'as_entered';
  allFailure.sets.forEach((set) => { set.rir = 0; });
  assert.notEqual(calculateSession(planned).candidateKg, calculateSession(allFailure).candidateKg);
  assert.equal(calculateSession(planned).anchors.length, 1);
});

test('V3 supports kg/lb and reports transfer and extrapolation states', () => {
  const kg = calculateSession(makeSession());
  const lbInput = { ...makeSession(), unit: 'lb', weight: 80 * 2.2046226218 };
  near(kg.estimateKg, calculateSession(lbInput).estimateKg, 1e-7);
  assert.equal(calculateSession({ ...makeSession(), exercise: 'squat' }).status, 'transfer_experimental');
  assert.equal(calculateSession(makeSession(6)).status, 'extrapolation_experimental');
});

test('V3 refuses missing effort, a ninth set and strong mismatch without exposing a main estimate', () => {
  const missing = makeSession();
  missing.effort = 'as_entered';
  assert.equal(calculateSession(missing).status, 'insufficient');
  assert.equal(calculateSession(makeSession(9)).status, 'unsupported');
  const mismatch = makeSession(8);
  mismatch.effort = 'as_entered';
  mismatch.sets = [8, 8, 7, 6, 5, 4, 3, 2].map((reps, index) => index === 7 ? { reps, rir: 0 } : { reps, rir: 0, restMinutes: 5 });
  const result = calculateSession(mismatch);
  assert.equal(result.status, 'review_required');
  assert.equal(result.estimateKg, null);
  assert.ok(result.candidateKg > 0);
});

test('support page documents V3 and removes legacy reward claims', async () => {
  const supportPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'support', 'index.html');
  const html = await readFile(supportPath, 'utf8');
  assert.match(html, /单组计算模型/);
  assert.match(html, /多组计算模型 V3/);
  assert.match(html, /约 97kg/);
  assert.match(html, /mailto:wx@wzrice\.cn/);
  assert.doesNotMatch(html, /最高 \+8%|总修正上限：\+15%/);
});
