import { studies } from './literature.mjs';
import { pathToFileURL } from 'node:url';

export function dose(reps, rests, tau) {
  const x = [0];
  for (let i = 1; i < reps.length; i++) x.push((x[i - 1] + reps[i - 1]) * Math.exp(-rests[i - 1] / tau));
  return x;
}

// Equal total weight per study; correlated group means are not individuals.
// Integer grid is deterministic: tau=0.10..30.00 minutes, step 0.01.
export function calibrate(selected = studies.filter(s => s.role === 'calibration')) {
  let best = { loss: Infinity };
  for (let tick = 10; tick <= 3000; tick++) {
    const tau = tick / 100;
    const rows = selected.flatMap(s => {
      const count = s.conditions.reduce((n, c) => n + c.reps.length - 1, 0);
      return s.conditions.flatMap(c => {
        const x = dose(c.reps, Array(c.reps.length - 1).fill(c.rest), tau);
        return c.reps.slice(1).map((r, i) => ({ x: x[i + 1], y: c.reps[0] - r, w: 1 / count }));
      });
    });
    const beta = Math.max(0, rows.reduce((s, p) => s + p.w * p.x * p.y, 0) / rows.reduce((s, p) => s + p.w * p.x ** 2, 0));
    const loss = rows.reduce((s, p) => s + p.w * (p.y - beta * p.x) ** 2, 0);
    if (loss < best.loss) best = { tau, beta, loss };
  }
  let xx = 0, xy = 0;
  for (const s of selected) for (const c of s.conditions) {
    const x = 1 / s.relativeLoad - 1, y = c.reps[0] - 1, w = 1 / s.conditions.length;
    xx += w * x * x; xy += w * x * y;
  }
  return { ...best, k: xy / xx };
}

export function evaluate(study, p) {
  const rows = study.conditions.flatMap(c => {
    const x = dose(c.reps, Array(c.reps.length - 1).fill(c.rest), p.tau);
    return c.reps.slice(1).map((r, i) => ({ rest: c.rest, set: i + 2, observed: r,
      predicted: c.reps[0] - p.beta * x[i + 1] }));
  });
  const errors = rows.map(r => r.predicted - r.observed);
  const tolerance = study.readingToleranceReps ?? 0;
  return { study: study.id, role: study.role, approximateFigureReadings: !!study.laterSetsDigitized, count: rows.length,
    rmseReps: Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length),
    maeReps: errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length,
    maxAbsReps: Math.max(...errors.map(Math.abs)),
    fixedParameterReadingRmseRange: [
      Math.sqrt(errors.reduce((s, e) => s + Math.max(0, Math.abs(e) - tolerance) ** 2, 0) / errors.length),
      Math.sqrt(errors.reduce((s, e) => s + (Math.abs(e) + tolerance) ** 2, 0) / errors.length),
    ], rows };
}

export function digitizationSensitivity() {
  const selected = studies.filter(s => s.role === 'calibration');
  return Array.from({ length: 8 }, (_, mask) => {
    const adjusted = selected.map(s => !s.laterSetsDigitized ? s : { ...s,
      conditions: s.conditions.map((c, i) => ({ ...c, reps: [c.reps[0], c.reps[1] + ((mask >> i) & 1 ? 1 : -1) * s.readingToleranceReps] })) });
    const p = calibrate(adjusted), x = dose([5,5,5,5,5], [5,5,5,5], p.tau).at(-1);
    return { signs: Array.from({ length: 3 }, (_, i) => (mask >> i) & 1 ? 1 : -1),
      parameters: p, example80kg5x5Rest5NearFailureKg: 80 * (1 + (4.5 + p.beta * x) / p.k) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const training = studies.filter(s => s.role === 'calibration');
  const parameters = calibrate(training);
  console.log(JSON.stringify({ parameters, fits: studies.map(s => evaluate(s, parameters)),
    leaveOneStudyOut: training.map(held => {
      const p = calibrate(training.filter(s => s !== held));
      return { trainedOn: training.filter(s => s !== held).map(s => s.id), parameters: p, heldOut: evaluate(held, p) };
    }), digitizationSensitivity: digitizationSensitivity(),
    caveat: 'Group-mean repetition error conditioned on observed history, NOT individual 1RM accuracy or a clinical confidence interval. Richmond later-set values are approximate figure readings; sensitivity is not a statistical confidence interval.' }, null, 2));
}
