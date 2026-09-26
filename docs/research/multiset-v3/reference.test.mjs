import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSession, fatigueDose, capacityToKg, PARAMETERS, KG_PER_LB } from './reference.mjs';
import { calibrate } from './calibrate.mjs';

const near = (actual, expected, tol = 1e-9) => assert.ok(Math.abs(actual - expected) < tol, `${actual} != ${expected}`);
const make = (n = 5, rest = 5, reps = 5) => ({ weight: 80, exercise: 'bench_press', effort: 'last_near_failure',
  sets: Array.from({ length: n }, () => ({ reps, restMinutes: rest })) });

test('published means reproduce frozen parameters', () => {
  const p = calibrate(); for (const key of ['beta', 'tau', 'k']) near(p[key], PARAMETERS[key]);
});
test('1RM boundary is exact; scaling holds', () => { near(capacityToKg(80, 1), 80); near(capacityToKg(160, 8), 2 * capacityToKg(80, 8)); });
test('zero/infinite rest kernel limits', () => { assert.deepEqual(fatigueDose([5, 5, 3], [0, 0]), [0, 5, 10]); assert.deepEqual(fatigueDose([5, 5, 3], [Infinity, Infinity]), [0, 0, 0]); });
test('explicit convolution equals recurrence', () => {
  const r = [5, 4, 3, 2], rests = [1, 3, 5], x = fatigueDose(r, rests);
  for (let i = 1; i < r.length; i++) near(x[i], r.slice(0, i).reduce((sum, reps, j) => sum + reps * Math.exp(-rests.slice(j, i).reduce((a, b) => a + b, 0) / PARAMETERS.tau), 0));
});
test('80kg 5x5 5-minute reference regression', () => {
  const r = calculateSession(make()); near(r.estimateKg, 96.99984223003528); assert.deepEqual(r.anchors, [{ index: 4, lo: 0, hi: 1, source: 'selected_near_failure_interval' }]);
  near(r.effortOnlyRangeKg[1] - r.effortOnlyRangeKg[0], 80 / PARAMETERS.k);
});
test('earlier volume changes final-anchor estimate', () => {
  const a = make(), b = make(); b.sets[0].reps = 3;
  assert.ok(calculateSession(a).candidateKg > calculateSession(b).candidateKg);
});
test('first unknown RIR is NOT zero RIR', () => {
  const a = make(), b = make(); b.sets.forEach(s => { s.rir = 0; });
  assert.notEqual(calculateSession(a).candidateKg, calculateSession(b).candidateKg);
  assert.equal(calculateSession(a).anchors.length, 1); assert.equal(calculateSession(b).anchors.length, 5);
});
test('explicit final RIR overrides near-failure preset', () => {
  const a = make(); a.sets.at(-1).rir = 0; const r = calculateSession(a);
  near(r.estimateKg, 95.75927057461648); assert.equal(r.anchors[0].source, 'reported');
});
test('all missing RIR never silently produces an estimate', () => { const a = make(); a.effort = 'as_entered'; assert.equal(calculateSession(a).status, 'insufficient'); });
test('all-known requires all RIR', () => { const a = make(); a.effort = 'all_known'; assert.equal(calculateSession(a).status, 'insufficient'); });
test('only first RIR cannot be advertised as multi-set inversion', () => {
  const a = make(); a.effort = 'as_entered'; a.sets[0].rir = 2;
  assert.deepEqual(calculateSession(a).reasons, ['last_effort_anchor_required']);
});
test('assumption scenarios crossing supported capacity domain warn', () => {
  const a = make(2, 2); a.sets[0].reps = 2; a.sets[1].reps = 1;
  const r = calculateSession(a); assert.ok(r.scenarios.some(s => !s.withinDomain));
  assert.ok(r.warnings.includes('assumption_range_crosses_supported_domain'));
});
test('lb and kg equivalent', () => { const a = make(), b = { ...make(), weight: 80 / KG_PER_LB, unit: 'lb' }; near(calculateSession(a).estimateKg, calculateSession(b).estimateKg); });
test('input not mutated', () => { const a = make(), before = JSON.stringify(a); calculateSession(a); assert.equal(JSON.stringify(a), before); });
test('non-bench transfer cannot appear calibrated for that exercise', () => { const a = { ...make(), exercise: 'squat' }; const r = calculateSession(a); assert.equal(r.status, 'transfer_experimental'); assert.ok(r.warnings.includes('bench_press_prior_transferred_to_unverified_exercise')); });
test('unused final rest ignored', () => { const a = make(); a.sets.at(-1).restMinutes = 'unused'; near(calculateSession(a).estimateKg, calculateSession(make()).estimateKg); });
test('strong mismatch suppresses point estimate', () => {
  const a = make(8); a.effort = 'all_known'; a.sets = [8,8,7,6,5,4,3,2].map(reps => ({ reps, rir: 0, restMinutes: 5 }));
  const r = calculateSession(a); assert.equal(r.status, 'review_required'); assert.equal(r.estimateKg, null); assert.ok(r.candidateKg > 0);
});
test('same data can revise estimate down; no PR guarantee', () => {
  const a = { ...make(2), weight: 100, effort: 'all_known' }; a.sets.forEach(s => { s.rir = 0; });
  const b = { ...a, sets: [...a.sets, { reps: 3, rir: 0, restMinutes: 5 }] };
  near(calculateSession(a).estimateKg, 113.84610011808311); near(calculateSession(b).estimateKg, 113.57777376913656);
  assert.equal(calculateSession(b).status, 'caution_experimental');
});

for (let n = 2; n <= 8; n++) for (const rest of [1, 2, 3, 4, 5]) {
  test(`${n} sets rest ${rest}: finite ordered outputs and correct volume`, () => {
    const r = calculateSession(make(n, rest)); assert.ok(Number.isFinite(r.candidateKg));
    assert.ok(r.assumptionRangeKg[0] <= r.candidateKg && r.assumptionRangeKg[1] >= r.candidateKg);
    assert.equal(r.stats.volumeKgReps, n * 5 * 80);
    if (n >= 6) assert.ok(r.warnings.includes('six_to_eight_sets_extrapolation'));
  });
}
for (const rest of [3, 5]) test(`identical planned sets have diminishing positive gains, rest ${rest}`, () => {
  const v = Array.from({ length: 7 }, (_, i) => calculateSession(make(i + 2, rest)).candidateKg);
  const d = v.slice(1).map((x, i) => x - v[i]); assert.ok(d.every(x => x > 0)); assert.ok(d.slice(1).every((x, i) => x < d[i]));
});
for (const [name, edit, expected] of [
  ['empty sets', a => { a.sets = []; }, 'unsupported'],
  ['single', a => { a.sets = a.sets.slice(0,1); }, 'unsupported'],
  ['nine sets', a => { a.sets = make(9).sets; }, 'unsupported'],
  ['invalid weight', a => { a.weight = NaN; }, 'invalid'],
  ['blank weight', a => { a.weight = ''; }, 'invalid'],
  ['boolean weight', a => { a.weight = true; }, 'invalid'],
  ['zero weight', a => { a.weight = 0; }, 'invalid'],
  ['missing rest', a => { delete a.sets[0].restMinutes; }, 'unsupported'],
  ['too short rest', a => { a.sets[0].restMinutes = .5; }, 'unsupported'],
  ['too long rest', a => { a.sets[0].restMinutes = 6; }, 'unsupported'],
  ['fractional reps', a => { a.sets[0].reps = 4.5; }, 'unsupported'],
  ['thirteen reps', a => { a.sets[0].reps = 13; }, 'unsupported'],
  ['zero reps', a => { a.sets[0].reps = 0; }, 'unsupported'],
  ['negative RIR', a => { a.sets[0].rir = -1; }, 'invalid'],
  ['blank RIR', a => { a.sets[0].rir = ''; }, 'invalid'],
  ['numeric string RIR', a => { a.sets[0].rir = '0'; }, 'invalid'],
  ['per-set weight', a => { a.sets[0].weight = 80; }, 'unsupported'],
  ['warmup', a => { a.sets[0].warmup = true; }, 'unsupported'],
]) test(name, () => { const a = make(); edit(a); assert.equal(calculateSession(a).status, expected); });
