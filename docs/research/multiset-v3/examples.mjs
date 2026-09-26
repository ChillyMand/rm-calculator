import { calculateSession } from './reference.mjs';
const f = x => x === null ? '—' : x.toFixed(1);
const rows = [];
for (const rest of [3, 5]) for (let n = 2; n <= 8; n++) {
  const input = { weight: 80, exercise: 'bench_press', effort: 'last_near_failure',
    sets: Array.from({ length: n }, () => ({ reps: 5, restMinutes: rest })) };
  rows.push({ name: `80kg / ${n}×5 / 休息${rest}分 / 末组接近力竭`, input, result: calculateSession(input) });
}
for (const [weight, reps, rest, effort, rir] of [
  [80, [3, 3, 3, 3, 3], 3, 'last_near_failure', null],
  [80, [8, 8, 8, 8, 8], 5, 'last_near_failure', null],
  [80, [5, 5, 5, 5, 5], 5, 'as_entered', 0],
  [80, [5, 5, 5, 5, 5], 5, 'as_entered', 1],
  [100, [5, 5], 5, 'all_known', 0],
  [100, [5, 5, 3], 5, 'all_known', 0],
  [80, [5, 5, 4, 4, 3], 5, 'last_near_failure', null],
  [80, [8, 8, 7, 6, 5, 4, 3, 2], 5, 'all_known', 0],
  [80, [5, 5, 5, 5, 5, 5, 5, 5, 5], 5, 'last_near_failure', null],
]) {
  const input = { weight, exercise: 'bench_press', effort, sets: reps.map((r, i) => ({ reps: r, restMinutes: rest,
    rir: effort === 'all_known' || (effort === 'as_entered' && i === reps.length - 1) ? rir : null })) };
  rows.push({ name: `${weight}kg / [${reps.join(',')}] / ${rest}分 / ${effort}${rir === null ? '' : ` RIR${rir}`}`, input, result: calculateSession(input) });
}
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else {
  console.log('| 情形 | 点估计kg | 仅末组余力变化kg | 参数/余力/权重假设范围kg | 状态 |');
  console.log('|---|---:|---|---|---|');
  for (const { name, result: r } of rows) console.log(`| ${name} | ${f(r.estimateKg)} | ${r.effortOnlyRangeKg?.map(f).join('–') ?? '—'} | ${r.assumptionRangeKg?.map(f).join('–') ?? '—'} | ${r.status} |`);
}
