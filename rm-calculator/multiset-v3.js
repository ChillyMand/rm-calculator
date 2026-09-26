// Literature-calibrated prototype, not a validated individual 1RM predictor.
// Kept dependency-free so the browser and Node tests execute the same model.
export const MODEL_VERSION = 'multiset-capacity-v3.0.0-beta';
export const KG_PER_LB = 0.45359237;
export const PARAMETERS = Object.freeze({ beta: 0.6521771421983982, tau: 5.88, k: 32.2432 });
export const SENSITIVITY_PARAMETERS = Object.freeze([
  PARAMETERS,
  Object.freeze({ beta: 0.7523709773842823, tau: 2.94, k: 31.9 }),
  Object.freeze({ beta: 0.7109026367000065, tau: 6.57, k: 32.85333333333334 }),
]);

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

export function fatigueDose(reps, rests, tau = PARAMETERS.tau) {
  if (!Array.isArray(reps) || !reps.length || !reps.every((value) => finite(value) && value > 0)
    || !Array.isArray(rests) || rests.length !== reps.length - 1
    || !rests.every((value) => typeof value === 'number' && value >= 0 && !Number.isNaN(value))
    || !finite(tau) || tau <= 0) throw new RangeError('Invalid fatigue kernel input');
  const dose = [0];
  for (let index = 1; index < reps.length; index += 1) {
    dose.push((dose[index - 1] + reps[index - 1]) * Math.exp(-rests[index - 1] / tau));
  }
  return dose;
}

export function capacityToKg(weightKg, freshReps, k = PARAMETERS.k) {
  if (![weightKg, freshReps, k].every(finite) || weightKg <= 0 || freshReps < 1 || k <= 0) {
    throw new RangeError('Invalid capacity conversion');
  }
  return weightKg * (1 + (freshReps - 1) / k);
}

export function fitCapacity(sets, anchors, parameters = PARAMETERS, endpoint = 0.5, weighting = 'early') {
  if (!['early', 'equal'].includes(weighting) || !finite(endpoint) || endpoint < 0 || endpoint > 1
    || ![parameters.beta, parameters.tau, parameters.k].every(finite)
    || parameters.beta < 0 || parameters.tau <= 0 || parameters.k <= 0 || !anchors.length) {
    throw new RangeError('Invalid fit input');
  }
  const dose = fatigueDose(sets.map((set) => set.reps), sets.slice(0, -1).map((set) => set.restMinutes), parameters.tau);
  const corrected = anchors.map((anchor) => ({
    index: anchor.index,
    value: sets[anchor.index].reps + anchor.lo + endpoint * (anchor.hi - anchor.lo) + parameters.beta * dose[anchor.index],
    weight: weighting === 'early' ? 1 / (anchor.index + 1) : 1,
  }));
  const totalWeight = corrected.reduce((sum, anchor) => sum + anchor.weight, 0);
  const freshReps = corrected.reduce((sum, anchor) => sum + anchor.weight * anchor.value, 0) / totalWeight;
  const predictedCapacity = dose.map((value) => freshReps - parameters.beta * value);
  const anchorResiduals = anchors.map((anchor) => {
    const capacity = predictedCapacity[anchor.index];
    const lower = sets[anchor.index].reps + anchor.lo;
    const upper = sets[anchor.index].reps + anchor.hi;
    return capacity < lower ? capacity - lower : capacity > upper ? capacity - upper : 0;
  });
  const completionShortfall = sets.map((set, index) => Math.max(0, set.reps - predictedCapacity[index]));
  return {
    freshReps,
    dose,
    fatigueReps: dose.map((value) => parameters.beta * value),
    corrected,
    predictedCapacity,
    anchorResiduals,
    completionShortfall,
    maxDiscrepancyReps: Math.max(...anchorResiduals.map(Math.abs), ...completionShortfall),
  };
}

export function calculateSession(input) {
  const base = {
    modelVersion: MODEL_VERSION,
    estimateKg: null,
    candidateKg: null,
    assumptionRangeKg: null,
    warnings: [],
    reasons: [],
  };
  const reject = (status, reason) => ({ ...base, status, reasons: [reason] });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reject('invalid', 'invalid_input');
  const { sets, weight, unit = 'kg', exercise = 'unspecified', effort = 'as_entered' } = input;
  if (!['kg', 'lb'].includes(unit)) return reject('invalid', 'invalid_unit');
  if (!finite(weight) || weight <= 0 || weight > 1000000) return reject('invalid', 'invalid_weight');
  if (!Array.isArray(sets) || sets.length < 2) return reject('unsupported', 'use_single_set_mode');
  if (sets.length > 8) return reject('unsupported', 'too_many_sets');
  if (!['as_entered', 'last_near_failure', 'all_known'].includes(effort)) return reject('invalid', 'invalid_effort_mode');
  if (!['bench_press', 'squat', 'deadlift', 'other', 'unspecified'].includes(exercise)) return reject('invalid', 'invalid_exercise');
  for (let index = 0; index < sets.length; index += 1) {
    const set = sets[index];
    if (!set || typeof set !== 'object' || Array.isArray(set)) return reject('invalid', 'invalid_set');
    if (set.weight !== undefined) return reject('unsupported', 'per_set_weight_not_supported');
    if (set.warmup === true) return reject('unsupported', 'remove_warmup_sets');
    if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > 12) return reject('unsupported', 'outside_rep_domain');
    if (set.rir !== undefined && set.rir !== null
      && (!Number.isInteger(set.rir) || set.rir < 0 || set.rir > 4)) return reject('invalid', 'invalid_rir');
    if (index < sets.length - 1
      && (!finite(set.restMinutes) || set.restMinutes < 1 || set.restMinutes > 5)) {
      return reject('unsupported', 'rest_required_1_to_5_minutes');
    }
  }
  const weightKg = weight * (unit === 'lb' ? KG_PER_LB : 1);
  const anchors = sets.flatMap((set, index) => set.rir === undefined || set.rir === null
    ? [] : [{ index, lo: set.rir, hi: set.rir, source: 'reported' }]);
  if (effort === 'all_known' && anchors.length !== sets.length) return reject('insufficient', 'all_rir_required');
  if (effort === 'last_near_failure' && !anchors.some((anchor) => anchor.index === sets.length - 1)) {
    anchors.push({ index: sets.length - 1, lo: 0, hi: 1, source: 'selected_near_failure_interval' });
  }
  if (!anchors.length) return reject('insufficient', 'effort_anchor_required');
  if (!anchors.some((anchor) => anchor.index === sets.length - 1)) return reject('insufficient', 'last_effort_anchor_required');

  const fit = fitCapacity(sets, anchors);
  const candidateKg = capacityToKg(weightKg, Math.max(1, fit.freshReps));
  const scenarios = SENSITIVITY_PARAMETERS.flatMap((parameters, parameterIndex) => [0, 1].flatMap((endpoint) => ['early', 'equal'].map((weighting) => {
    const scenarioFit = fitCapacity(sets, anchors, parameters, endpoint, weighting);
    return {
      parameterIndex,
      endpoint,
      weighting,
      freshReps: scenarioFit.freshReps,
      estimateKg: capacityToKg(weightKg, Math.max(1, scenarioFit.freshReps), parameters.k),
      maxDiscrepancyReps: scenarioFit.maxDiscrepancyReps,
      withinDomain: scenarioFit.freshReps >= 2 && scenarioFit.freshReps <= 12,
      withinMismatchTolerance: scenarioFit.maxDiscrepancyReps <= 1.5,
    };
  })));
  const reasons = [];
  const warnings = [
    'experimental_not_individually_validated',
    'assumption_range_not_prediction_interval',
    'first_work_set_assumed_recovered',
    'same_load_exercise_technique_required',
  ];
  if (exercise !== 'bench_press') warnings.push('bench_press_prior_transferred_to_unverified_exercise');
  if (sets.length >= 6) warnings.push('six_to_eight_sets_extrapolation');
  if (anchors.some((anchor) => anchor.lo !== anchor.hi)) warnings.push('near_failure_rir_0_to_1_assumed_not_measured');
  if (sets.some((set, index) => !anchors.some((anchor) => anchor.index === index))) warnings.push('partial_set_fatigue_transfer_is_unvalidated');
  if (fit.maxDiscrepancyReps > 0.5) warnings.push('model_data_mismatch');
  if (scenarios.some((scenario) => scenario.maxDiscrepancyReps > 1.5)) warnings.push('sensitive_to_population_parameters');
  if (scenarios.some((scenario) => !scenario.withinDomain)) warnings.push('assumption_range_crosses_supported_domain');
  if (fit.freshReps < 2 || fit.freshReps > 12) reasons.push('fresh_capacity_outside_2_to_12');
  if (fit.maxDiscrepancyReps > 1.5) reasons.push('model_data_discrepancy_above_1_5_reps');
  const result = {
    ...base,
    candidateKg,
    anchors,
    fit,
    scenarios,
    warnings,
    assumptionRangeKg: [Math.min(...scenarios.map((scenario) => scenario.estimateKg)), Math.max(...scenarios.map((scenario) => scenario.estimateKg))],
    effortOnlyRangeKg: [0, 1].map((endpoint) => capacityToKg(weightKg, Math.max(1, fitCapacity(sets, anchors, PARAMETERS, endpoint).freshReps))),
    stats: {
      sets: sets.length,
      totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
      volumeKgReps: weightKg * sets.reduce((sum, set) => sum + set.reps, 0),
      lastToFirstRepRatio: sets.at(-1).reps / sets[0].reps,
    },
  };
  if (reasons.length) return { ...result, status: 'review_required', reasons };
  const status = fit.maxDiscrepancyReps > 0.5 ? 'caution_experimental'
    : exercise !== 'bench_press' ? 'transfer_experimental'
      : sets.length >= 6 ? 'extrapolation_experimental' : 'ok_experimental';
  return { ...result, status, estimateKg: candidateKg };
}
