export const FORMULAS = {
  epley: { label: 'Epley', calculate: (w, r) => w * (1 + r / 30) },
  brzycki: { label: 'Brzycki', calculate: (w, r) => r < 37 ? w * 36 / (37 - r) : null },
  lander: { label: 'Lander', calculate: (w, r) => w * 100 / (101.3 - 2.67123 * r) },
  lombardi: { label: 'Lombardi', calculate: (w, r) => w * r ** 0.1 },
  mayhew: { label: 'Mayhew', calculate: (w, r) => w * 100 / (52.2 + 41.9 * Math.exp(-0.055 * r)) },
  oconnor: { label: "O'Conner", calculate: (w, r) => w * (1 + r / 40) },
  wathan: { label: 'Wathan', calculate: (w, r) => w * 100 / (48.8 + 53.8 * Math.exp(-0.075 * r)) },
  nsca: { label: 'NSCA/Baechle', calculate: (w, r) => w * (1 + 0.0333 * r) },
};

export const DEFAULT_FORMULA_CONFIG = {
  enabled: Object.fromEntries(Object.keys(FORMULAS).map((key) => [key, true])),
  trimHighest: true,
  trimLowest: true,
};

function normalizeFormulaConfig(config = DEFAULT_FORMULA_CONFIG) {
  const enabled = Object.fromEntries(Object.keys(FORMULAS).map((key) => [key, config.enabled?.[key] !== false]));
  if (!Object.values(enabled).some(Boolean)) enabled[Object.keys(FORMULAS)[0]] = true;
  return { enabled, trimHighest: config.trimHighest !== false, trimLowest: config.trimLowest !== false };
}

export const MODEL_PARAMS = {
  maxSetBonus: 0.08,
  maxRestBonus: 0.04,
  maxConsistencyBonus: 0.03,
  maxTotalBonus: 0.15,
};

export const RM_PERCENTAGES = [
  [1, 1], [2, 0.95], [3, 0.93], [4, 0.9], [5, 0.87], [6, 0.85], [7, 0.83],
  [8, 0.8], [9, 0.77], [10, 0.75], [11, 0.73], [12, 0.7], [13, 0.68],
  [14, 0.65], [15, 0.63], [16, 0.6], [17, 0.58], [18, 0.55], [19, 0.53],
  [20, 0.5], [22, 0.48], [25, 0.45], [30, 0.42],
];

export function calculateSet({ weight, reps, rir = 0 }, formulaConfig = DEFAULT_FORMULA_CONFIG) {
  const formulaSettings = normalizeFormulaConfig(formulaConfig);
  const effectiveReps = Number(reps) + Number(rir || 0);
  if (effectiveReps === 1) {
    const exact = Number(weight);
    const formulas = Object.fromEntries(Object.keys(FORMULAS).filter((key) => formulaSettings.enabled[key]).map((key) => [key, exact]));
    return { weight: exact, reps: Number(reps), rir: Number(rir || 0), effectiveReps, formulas, average: exact, range: { min: exact, max: exact } };
  }
  const formulas = {};
  for (const [key, formula] of Object.entries(FORMULAS)) {
    if (!formulaSettings.enabled[key]) continue;
    const value = formula.calculate(Number(weight), effectiveReps);
    if (Number.isFinite(value) && value > 0) formulas[key] = value;
  }
  const values = Object.values(formulas);
  const sortedValues = [...values].sort((a, b) => a - b);
  const start = formulaSettings.trimLowest && sortedValues.length >= 2 ? 1 : 0;
  const end = formulaSettings.trimHighest && sortedValues.length - start >= 2 ? sortedValues.length - 1 : sortedValues.length;
  const trimmedValues = sortedValues.slice(start, end);
  return {
    weight: Number(weight), reps: Number(reps), rir: Number(rir || 0), effectiveReps,
    formulas,
    average: trimmedValues.reduce((sum, value) => sum + value, 0) / trimmedValues.length,
    range: { min: Math.min(...values), max: Math.max(...values) },
  };
}

function restContribution(minutes) {
  if (minutes >= 5) return 0;
  if (minutes >= 4) return 0.005;
  if (minutes >= 3) return 0.01;
  if (minutes >= 2) return 0.02;
  if (minutes >= 1.5) return 0.03;
  return 0.04;
}

export function calculateMultiSet(inputSets, params = MODEL_PARAMS) {
  const config = { ...MODEL_PARAMS, ...params };
  const validSets = inputSets.filter((set) => !set.warmup && validateSet(set).valid);
  if (!validSets.length) return { sets: [], error: '请至少添加一组有效训练数据' };
  const sets = validSets.map((set) => ({ ...set, result: calculateSet(set, config.formulaConfig) }));
  const weightTotal = sets.reduce((sum, set) => sum + set.weight, 0);
  const baseEstimate = sets.reduce((sum, set) => sum + set.result.average * set.weight, 0) / weightTotal;
  const count = sets.length;
  const setBonus = sets[0].result.effectiveReps === 1 ? 0 : config.maxSetBonus * ((count - 1) / (count + 3));
  const rests = sets.slice(0, -1).map((set) => Number(set.rest)).filter((value, index) => sets[index].rest !== '' && Number.isFinite(value));
  const averageRest = rests.length ? rests.reduce((sum, value) => sum + value, 0) / rests.length : null;
  const restBonus = sets[0].result.effectiveReps === 1 ? 0 : averageRest === null ? 0 : restContribution(averageRest);
  const firstReps = sets[0].result.effectiveReps;
  const consistencyFactor = count === 1 ? 0 : sets.slice(1).reduce((sum, set) => sum + set.result.effectiveReps / firstReps, 0) / (count - 1);
  const consistencyBonus = sets[0].result.effectiveReps === 1 ? 0 : config.maxConsistencyBonus * Math.max(0, Math.min(1, consistencyFactor));
  const totalBonus = Math.min(config.maxTotalBonus, setBonus + restBonus + consistencyBonus);
  const stats = {
    totalSets: count,
    totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
    volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
    averageRest,
  };
  return {
    sets, baseEstimate, multiEstimate: baseEstimate * (1 + totalBonus),
    bonuses: { sets: setBonus, rest: restBonus, consistency: consistencyBonus, total: totalBonus },
    consistencyFactor, stats,
  };
}

export function validateSet({ weight, reps }) {
  if (weight === '' || weight === null || weight === undefined) return { valid: false, message: '请输入重量' };
  if (reps === '' || reps === null || reps === undefined) return { valid: false, message: '请输入次数' };
  if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) return { valid: false, message: '重量必须大于0' };
  if (!Number.isInteger(Number(reps)) || Number(reps) < 1) return { valid: false, message: '次数必须至少为1' };
  if (Number(reps) > 30) return { valid: false, message: '建议输入1～30次范围内的数据' };
  return { valid: true, message: '' };
}

export function kgToLb(kg) { return Number(kg) * 2.2046226218; }
export function lbToKg(lb) { return Number(lb) / 2.2046226218; }
export function roundWeight(weight, increment = 0.5) { return Math.round(Number(weight) / increment) * increment; }

export function buildRmTable(oneRm, increment = 0.5) {
  return RM_PERCENTAGES.map(([rm, percentage]) => ({ rm, percentage, weight: roundWeight(oneRm * percentage, increment) }));
}
