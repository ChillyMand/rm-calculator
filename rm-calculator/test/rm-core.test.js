import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  FORMULAS,
  calculateSet,
  calculateMultiSet,
  kgToLb,
  lbToKg,
  roundWeight,
  validateSet,
} from '../rm-core.js';

test('calculates all eight formulas and a valid average for one set', () => {
  const result = calculateSet({ weight: 80, reps: 5, rir: 0 });
  assert.equal(Object.keys(result.formulas).length, 8);
  assert.equal(Object.keys(FORMULAS).length, 8);
  assert.ok(result.average > 90 && result.average < 100);
  assert.equal(result.effectiveReps, 5);
});

test('RIR increases effective reps and the estimated one rep max', () => {
  const exhausted = calculateSet({ weight: 80, reps: 5, rir: 0 });
  const reserve = calculateSet({ weight: 80, reps: 5, rir: 2 });
  assert.equal(reserve.effectiveReps, 7);
  assert.ok(reserve.average > exhausted.average);
});

test('multi-set model excludes warmups and applies capped configurable bonuses', () => {
  const result = calculateMultiSet([
    { weight: 40, reps: 8, rir: 2, rest: 2, warmup: true },
    { weight: 80, reps: 5, rir: 0, rest: 5, warmup: false },
    { weight: 80, reps: 5, rir: 0, rest: 5, warmup: false },
    { weight: 80, reps: 5, rir: 0, rest: 5, warmup: false },
    { weight: 80, reps: 5, rir: 0, rest: 5, warmup: false },
    { weight: 80, reps: 5, rir: 0, rest: 0, warmup: false },
  ]);
  assert.equal(result.sets.length, 5);
  assert.equal(result.stats.totalReps, 25);
  assert.equal(result.stats.volume, 2000);
  assert.equal(result.bonuses.rest, 0);
  assert.equal(result.bonuses.consistency, 0.03);
  assert.ok(result.bonuses.total <= 0.15);
  assert.ok(result.multiEstimate > result.baseEstimate);
});

test('multi-set bonus is capped even with many stable short-rest sets', () => {
  const sets = Array.from({ length: 20 }, (_, index) => ({
    weight: 80, reps: 5, rir: 0, rest: index === 19 ? 0 : 1, warmup: false,
  }));
  const result = calculateMultiSet(sets, { maxSetBonus: 0.2 });
  assert.equal(result.bonuses.total, 0.15);
});

test('validation rejects empty and out-of-range inputs', () => {
  assert.deepEqual(validateSet({ weight: '', reps: 5 }), { valid: false, message: '请输入重量' });
  assert.deepEqual(validateSet({ weight: 80, reps: '' }), { valid: false, message: '请输入次数' });
  assert.deepEqual(validateSet({ weight: -1, reps: 5 }), { valid: false, message: '重量必须大于0' });
  assert.deepEqual(validateSet({ weight: 80, reps: 31 }), { valid: false, message: '建议输入1～30次范围内的数据' });
});

test('unit conversion and display rounding are reversible and predictable', () => {
  assert.ok(Math.abs(kgToLb(lbToKg(176.37)) - 176.37) < 0.01);
  assert.equal(roundWeight(87.3, 0.5), 87.5);
  assert.equal(roundWeight(87.3, 2.5), 87.5);
});

test('blank rest values do not receive a short-rest bonus', () => {
  const result = calculateMultiSet([
    { weight: 80, reps: 5, rir: '', rest: '' },
    { weight: 80, reps: 5, rir: '', rest: '' },
  ]);
  assert.equal(result.bonuses.rest, 0);
});

test('rest selector values from one to five minutes map to the configured bonus curve', () => {
  const oneMinute = calculateMultiSet([
    { weight: 80, reps: 5, rir: 0, rest: 1 },
    { weight: 80, reps: 5, rir: 0, rest: 1 },
  ]);
  const fiveMinutes = calculateMultiSet([
    { weight: 80, reps: 5, rir: 0, rest: 5 },
    { weight: 80, reps: 5, rir: 0, rest: 5 },
  ]);
  assert.equal(oneMinute.bonuses.rest, 0.04);
  assert.equal(fiveMinutes.bonuses.rest, 0);
});

test('one completed rep at RIR zero is exactly the entered one rep max', () => {
  const result = calculateSet({ weight: 80, reps: 1, rir: 0 });
  assert.equal(result.average, 80);
  assert.equal(result.range.min, 80);
  assert.equal(result.range.max, 80);
});

test('one rep max estimate removes one highest and one lowest formula result', () => {
  const result = calculateSet({ weight: 80, reps: 5, rir: 0 });
  const values = Object.values(result.formulas).sort((a, b) => a - b);
  const trimmedAverage = values.slice(1, -1).reduce((sum, value) => sum + value, 0) / 6;
  assert.equal(result.average, trimmedAverage);
  assert.equal(Object.keys(result.formulas).length, 8);
});

test('formula configuration controls enabled formulas and trimming switches', () => {
  const result = calculateSet({ weight: 80, reps: 5, rir: 0 }, {
    enabled: { epley: true, brzycki: true, lander: true, lombardi: false, mayhew: false, oconnor: false, wathan: false, nsca: false },
    trimHighest: false,
    trimLowest: false,
  });
  assert.deepEqual(Object.keys(result.formulas), ['epley', 'brzycki', 'lander']);
  const values = Object.values(result.formulas);
  assert.equal(result.average, values.reduce((sum, value) => sum + value, 0) / values.length);
});

test('multi-set one-rep max input does not receive performance bonuses', () => {
  const result = calculateMultiSet([
    { weight: 80, reps: 1, rir: 0, rest: 1 },
    { weight: 80, reps: 1, rir: 0, rest: 1 },
  ]);
  assert.equal(result.baseEstimate, 80);
  assert.equal(result.multiEstimate, 80);
  assert.equal(result.bonuses.total, 0);
});

test('support page documents both calculation models and provides the support email', async () => {
  const supportPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'support', 'index.html');
  const html = await readFile(supportPath, 'utf8');
  assert.match(html, /单组计算模型/);
  assert.match(html, /多组计算模型/);
  assert.match(html, /mailto:wx@wzrice\.cn/);
  assert.match(html, /80kg × 8/);
  assert.match(html, /80kg × 5 × 5/);
  assert.match(html, /\+4%/);
  assert.match(html, /\+3%/);
});
