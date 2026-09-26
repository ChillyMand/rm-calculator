// Literature-calibrated prototype, not a validated individual 1RM predictor.
// Browser-compatible, no dependencies, side effects, network or app imports.
export const MODEL_VERSION = 'multiset-capacity-v3.0.0-beta';
export const KG_PER_LB = 0.45359237;
export const PARAMETERS = Object.freeze({ beta: 0.6521771421983982, tau: 5.88, k: 32.2432 });
export const SENSITIVITY_PARAMETERS = Object.freeze([
  PARAMETERS,
  Object.freeze({ beta: 0.7523709773842823, tau: 2.94, k: 31.9 }),
  Object.freeze({ beta: 0.7109026367000065, tau: 6.57, k: 32.85333333333334 }),
]);
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function fatigueDose(reps, rests, tau = PARAMETERS.tau) {
  if (!Array.isArray(reps) || !reps.length || !reps.every(r => finite(r) && r > 0) ||
      !Array.isArray(rests) || rests.length !== reps.length - 1 ||
      !rests.every(t => typeof t === 'number' && t >= 0 && !Number.isNaN(t)) || !finite(tau) || tau <= 0) {
    throw new RangeError('Invalid fatigue kernel input');
  }
  const x = [0];
  for (let i = 1; i < reps.length; i++) x.push((x[i - 1] + reps[i - 1]) * Math.exp(-rests[i - 1] / tau));
  return x;
}

export function capacityToKg(weightKg, freshReps, k = PARAMETERS.k) {
  if (![weightKg, freshReps, k].every(finite) || weightKg <= 0 || freshReps < 1 || k <= 0) throw new RangeError('Invalid capacity conversion');
  return weightKg * (1 + (freshReps - 1) / k);
}

// Anchors contain genuine reported RIR, or an explicitly selected interval.
// Missing RIR supplies a completion check, never a zero-RIR measurement.
export function fitCapacity(sets, anchors, p = PARAMETERS, endpoint = 0.5, weighting = 'early') {
  if (!['early', 'equal'].includes(weighting) || !finite(endpoint) || endpoint < 0 || endpoint > 1 ||
      ![p.beta, p.tau, p.k].every(finite) || p.beta < 0 || p.tau <= 0 || p.k <= 0 || !anchors.length) throw new RangeError('Invalid fit input');
  const dose = fatigueDose(sets.map(s => s.reps), sets.slice(0, -1).map(s => s.restMinutes), p.tau);
  const corrected = anchors.map(a => ({ index: a.index,
    value: sets[a.index].reps + a.lo + endpoint * (a.hi - a.lo) + p.beta * dose[a.index],
    weight: weighting === 'early' ? 1 / (a.index + 1) : 1 }));
  const totalWeight = corrected.reduce((sum, a) => sum + a.weight, 0);
  const freshReps = corrected.reduce((sum, a) => sum + a.weight * a.value, 0) / totalWeight;
  const predictedCapacity = dose.map(x => freshReps - p.beta * x);
  const anchorResiduals = anchors.map(a => {
    const c = predictedCapacity[a.index], lower = sets[a.index].reps + a.lo, upper = sets[a.index].reps + a.hi;
    return c < lower ? c - lower : c > upper ? c - upper : 0;
  });
  const completionShortfall = sets.map((s, i) => Math.max(0, s.reps - predictedCapacity[i]));
  return { freshReps, dose, fatigueReps: dose.map(x => p.beta * x), corrected,
    predictedCapacity, anchorResiduals, completionShortfall,
    maxDiscrepancyReps: Math.max(...anchorResiduals.map(Math.abs), ...completionShortfall) };
}

export function calculateSession(input) {
  const base = { modelVersion: MODEL_VERSION, estimateKg: null, candidateKg: null,
    assumptionRangeKg: null, warnings: [], reasons: [] };
  const reject = (status, reason) => ({ ...base, status, reasons: [reason] });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reject('invalid', 'invalid_input');
  const { sets, weight, unit = 'kg', exercise = 'unspecified', effort = 'as_entered' } = input;
  if (!['kg', 'lb'].includes(unit)) return reject('invalid', 'invalid_unit');
  if (!finite(weight) || weight <= 0 || weight > 1000000) return reject('invalid', 'invalid_weight');
  if (!Array.isArray(sets) || sets.length < 2) return reject('unsupported', 'use_single_set_mode');
  if (sets.length > 8) return reject('unsupported', 'too_many_sets');
  if (!['as_entered', 'last_near_failure', 'all_known'].includes(effort)) return reject('invalid', 'invalid_effort_mode');
  if (!['bench_press', 'squat', 'deadlift', 'other', 'unspecified'].includes(exercise)) return reject('invalid', 'invalid_exercise');
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) return reject('invalid', 'invalid_set');
    // One session-level load: do not silently ignore an individual set's load.
    if (s.weight !== undefined) return reject('unsupported', 'per_set_weight_not_supported');
    if (s.warmup === true) return reject('unsupported', 'remove_warmup_sets');
    if (!Number.isInteger(s.reps) || s.reps < 1 || s.reps > 12) return reject('unsupported', 'outside_rep_domain');
    if (s.rir !== undefined && s.rir !== null && (!Number.isInteger(s.rir) || s.rir < 0 || s.rir > 4)) return reject('invalid', 'invalid_rir');
    if (i < sets.length - 1 && (!finite(s.restMinutes) || s.restMinutes < 1 || s.restMinutes > 5)) return reject('unsupported', 'rest_required_1_to_5_minutes');
  }
  const weightKg = weight * (unit === 'lb' ? KG_PER_LB : 1);
  const anchors = sets.flatMap((s, index) => s.rir === undefined || s.rir === null ? [] : [{ index, lo: s.rir, hi: s.rir, source: 'reported' }]);
  if (effort === 'all_known' && anchors.length !== sets.length) return reject('insufficient', 'all_rir_required');
  if (effort === 'last_near_failure' && !anchors.some(a => a.index === sets.length - 1)) anchors.push({ index: sets.length - 1, lo: 0, hi: 1, source: 'selected_near_failure_interval' });
  if (!anchors.length) return reject('insufficient', 'effort_anchor_required');
  if (!anchors.some(a => a.index === sets.length - 1)) return reject('insufficient', 'last_effort_anchor_required');
  const fit = fitCapacity(sets, anchors);
  const candidateKg = capacityToKg(weightKg, Math.max(1, fit.freshReps));
  const scenarios = SENSITIVITY_PARAMETERS.flatMap((p, parameterIndex) => [0, 1].flatMap(endpoint => ['early', 'equal'].map(weighting => {
    const f = fitCapacity(sets, anchors, p, endpoint, weighting);
    return { parameterIndex, endpoint, weighting, freshReps: f.freshReps,
      estimateKg: capacityToKg(weightKg, Math.max(1, f.freshReps), p.k), maxDiscrepancyReps: f.maxDiscrepancyReps,
      withinDomain: f.freshReps >= 2 && f.freshReps <= 12,
      withinMismatchTolerance: f.maxDiscrepancyReps <= 1.5 };
  })));
  const reasons = [];
  const warnings = ['experimental_not_individually_validated', 'assumption_range_not_prediction_interval',
    'first_work_set_assumed_recovered', 'same_load_exercise_technique_required'];
  if (exercise !== 'bench_press') warnings.push('bench_press_prior_transferred_to_unverified_exercise');
  if (sets.length >= 6) warnings.push('six_to_eight_sets_extrapolation');
  if (anchors.some(a => a.lo !== a.hi)) warnings.push('near_failure_rir_0_to_1_assumed_not_measured');
  if (sets.some((s, i) => !anchors.some(a => a.index === i))) warnings.push('partial_set_fatigue_transfer_is_unvalidated');
  if (fit.maxDiscrepancyReps > 0.5) warnings.push('model_data_mismatch');
  if (scenarios.some(s => s.maxDiscrepancyReps > 1.5)) warnings.push('sensitive_to_population_parameters');
  if (scenarios.some(s => !s.withinDomain)) warnings.push('assumption_range_crosses_supported_domain');
  if (fit.freshReps < 2 || fit.freshReps > 12) reasons.push('fresh_capacity_outside_2_to_12');
  if (fit.maxDiscrepancyReps > 1.5) reasons.push('model_data_discrepancy_above_1_5_reps');
  const result = { ...base, candidateKg, anchors, fit, scenarios, warnings,
    assumptionRangeKg: [Math.min(...scenarios.map(s => s.estimateKg)), Math.max(...scenarios.map(s => s.estimateKg))],
    effortOnlyRangeKg: [0, 1].map(e => capacityToKg(weightKg, Math.max(1, fitCapacity(sets, anchors, PARAMETERS, e).freshReps))),
    stats: { sets: sets.length, totalReps: sets.reduce((sum, s) => sum + s.reps, 0),
      volumeKgReps: weightKg * sets.reduce((sum, s) => sum + s.reps, 0),
      lastToFirstRepRatio: sets.at(-1).reps / sets[0].reps } };
  if (reasons.length) return { ...result, status: 'review_required', reasons };
  const status = fit.maxDiscrepancyReps > 0.5 ? 'caution_experimental'
    : exercise !== 'bench_press' ? 'transfer_experimental'
    : sets.length >= 6 ? 'extrapolation_experimental' : 'ok_experimental';
  return { ...result, status, estimateKg: candidateKg };
}
