import {
  FORMULAS,
  DEFAULT_FORMULA_CONFIG,
  calculateSet,
  validateSet,
  buildRmTable,
  kgToLb,
  lbToKg,
  roundWeight,
} from './rm-core.js';
import { calculateSession, MODEL_VERSION } from './multiset-v3.js';

const blankSet = () => ({ reps: '', rir: '', rest: '' });
const state = {
  mode: 'single', unit: 'kg', rounding: 0.1, single: { weight: '', reps: '' },
  multi: { weight: '', exercise: 'bench_press', lastEffort: 'near', uniformRest: '5', advanced: false },
  sets: [blankSet(), blankSet()],
};
const $ = (selector) => document.querySelector(selector);
const modelConfig = DEFAULT_FORMULA_CONFIG;
const displayWeight = (kg) => roundWeight(state.unit === 'kg' ? kg : kgToLb(kg), Number(state.rounding));
const display = (kg, decimals = 1) => Number.isFinite(kg) ? `${displayWeight(kg).toFixed(decimals)} ${state.unit}` : '—';
const setText = (selector, value) => { $(selector).textContent = value; };

const STATUS_COPY = {
  ok_experimental: ['实验估算', '已按 V3 群体参数完成反推。'],
  caution_experimental: ['拟合偏差提醒', '训练表现与默认群体模型存在偏差，请谨慎参考。'],
  transfer_experimental: ['跨动作迁移估算', '多组参数主要来自卧推研究，本动作尚未单独校准。'],
  extrapolation_experimental: ['组数外推估算', '6～8 组超出主要校准范围，结果仅供实验参考。'],
  review_required: ['暂不提供主估算', '输入与模型差异过大或反推容量超出范围，请复核训练数据。'],
  insufficient: ['信息不足', '需要明确最后一组的剩余余力，不能把未知 RIR 当作 0。'],
  unsupported: ['当前不支持', '请使用 2～8 组、同一重量、每组 1～12 次、组间休息 1～5 分钟。'],
  invalid: ['输入有误', '请检查重量、次数、RIR 和休息时间。'],
};
const REASON_COPY = {
  use_single_set_mode: '多组模式至少需要 2 个工作组。',
  too_many_sets: '多组模式最多支持 8 个工作组。',
  outside_rep_domain: '每组次数须为 1～12 的整数。',
  rest_required_1_to_5_minutes: '每段组间休息须为 1～5 分钟。',
  effort_anchor_required: '请选择末组余力，或在高级输入中填写 RIR。',
  last_effort_anchor_required: '必须填写最后一组 RIR，才能反推多组 e1RM。',
  fresh_capacity_outside_2_to_12: '反推的新鲜次数容量超出 2～12 次适用域。',
  model_data_discrepancy_above_1_5_reps: '各组表现与模型差异超过 1.5 次。',
};

function renderMode() {
  document.querySelectorAll('.mode').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
  $('#single-panel').classList.toggle('hidden', state.mode !== 'single');
  $('#multi-panel').classList.toggle('hidden', state.mode !== 'multi');
  $('#multi-summary').classList.toggle('hidden', state.mode !== 'multi');
  $('#single-weight').value = state.single.weight;
  $('#single-reps').value = state.single.reps;
  $('#multi-weight').value = state.multi.weight;
  $('#exercise').value = state.multi.exercise;
  $('#last-effort').value = state.multi.lastEffort;
  $('#uniform-rest').value = state.multi.uniformRest;
  $('#advanced-toggle').setAttribute('aria-expanded', String(state.multi.advanced));
  $('#advanced-toggle').textContent = state.multi.advanced ? '收起逐组设置' : '逐组设置 RIR / 休息';
  $('#unit').value = state.unit;
  $('#single-weight-unit').textContent = state.unit;
  $('#multi-weight-unit').textContent = state.unit;
  setText('#main-unit', state.unit);
  renderSets();
  calculate();
}

function renderSets() {
  $('#set-list').innerHTML = state.sets.map((set, index) => {
    const isLast = index === state.sets.length - 1;
    const rirOptions = ['<option value="">未知</option>', ...[0, 1, 2, 3, 4].map((value) => `<option value="${value}" ${Number(set.rir) === value && set.rir !== '' ? 'selected' : ''}>${value}</option>`)].join('');
    const restOptions = ['<option value="">统一</option>', ...[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${Number(set.rest) === value ? 'selected' : ''}>${value}</option>`)].join('');
    return `<div class="set-row v3-row ${state.multi.advanced ? 'advanced' : ''}" data-index="${index}">
      <div class="set-index">${String(index + 1).padStart(2, '0')}</div>
      <label>完成次数<input data-field="reps" type="number" min="1" max="12" step="1" value="${set.reps}" placeholder="1–12"></label>
      <label class="advanced-field">RIR<select data-field="rir">${rirOptions}</select></label>
      <label class="advanced-field">${isLast ? '组后休息' : '组间休息'}<select data-field="rest" ${isLast ? 'disabled' : ''}>${isLast ? '<option>不计</option>' : restOptions}</select></label>
      <button class="remove" aria-label="删除第${index + 1}组" data-action="remove" ${state.sets.length <= 2 ? 'disabled' : ''}>×</button>
    </div>`;
  }).join('');
  document.querySelectorAll('.set-row input,.set-row select').forEach((input) => input.addEventListener('input', onSetInput));
  document.querySelectorAll('[data-action="remove"]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.closest('.set-row').dataset.index);
    if (state.sets.length > 2) state.sets.splice(index, 1);
    renderSets();
    calculate();
  }));
  $('#add-set').disabled = state.sets.length >= 8;
}

function onSetInput(event) {
  const row = event.target.closest('.set-row');
  state.sets[Number(row.dataset.index)][event.target.dataset.field] = event.target.value;
  calculate();
}

function updateFormulaList(result) {
  const formulas = result?.formulas || {};
  setText('#detail-title', '公式计算详情');
  setText('#detail-note', '8 个经典公式');
  $('#formula-list').innerHTML = Object.entries(FORMULAS)
    .filter(([key]) => modelConfig.enabled[key])
    .map(([key, formula]) => `<div class="formula-line"><span>${formula.label}</span><b>${formulas[key] ? display(formulas[key]) : '无效'}</b></div>`)
    .join('') + (result ? `<div class="formula-line average"><span>综合平均</span><b>${display(result.average)}</b></div>` : '');
}

function renderV3Details(result) {
  setText('#detail-title', 'V3 模型诊断');
  setText('#detail-note', MODEL_VERSION);
  if (!result?.fit) {
    $('#formula-list').innerHTML = '<div class="formula-line average"><span>完成有效输入后显示模型诊断</span><b>—</b></div>';
    return;
  }
  const details = [
    ['反推新鲜次数容量', `${result.fit.freshReps.toFixed(2)} 次`],
    ['最大组间偏差', `${result.fit.maxDiscrepancyReps.toFixed(2)} 次`],
    ['末组余力范围', result.effortOnlyRangeKg?.map((value) => display(value)).join(' ～ ') || '—'],
    ['模型版本', 'V3.0 beta'],
  ];
  $('#formula-list').innerHTML = details.map(([label, value], index) => `<div class="formula-line ${index === 3 ? 'average' : ''}"><span>${label}</span><b>${value}</b></div>`).join('');
}

function renderRmTable(oneRm) {
  const common = new Set([5, 8, 10, 12]);
  $('#rm-table').innerHTML = buildRmTable(oneRm, 0.01).map(({ rm, percentage, weight }) => `<tr class="${common.has(rm) ? 'common-rm' : ''}"><td>${rm}RM</td><td>${Math.round(percentage * 100)}%</td><td>${display(weight)}</td></tr>`).join('');
}
function clearRmTable(message = '输入有效数据后生成训练重量') {
  $('#rm-table').innerHTML = `<tr><td colspan="3" class="muted">${message}</td></tr>`;
}
function renderEmpty() {
  setText('#main-result', '—');
  setText('#result-range', '—');
  $('#result-bar-fill').style.width = '0%';
  clearRmTable();
}
function clearMultiSummary() {
  for (const selector of ['#sets-result', '#reps-result', '#volume-result', '#retention-result']) setText(selector, '—');
  setText('#model-status', '等待输入');
  setText('#model-message', '填写 2～8 个同重量工作组后生成实验估算。');
  $('#model-status').dataset.status = 'empty';
}

function buildMultiInput() {
  const sets = state.sets.map((set, index) => {
    const normalized = { reps: Number(set.reps) };
    if (index < state.sets.length - 1) normalized.restMinutes = Number(state.multi.advanced && set.rest !== '' ? set.rest : state.multi.uniformRest);
    if (state.multi.advanced && set.rir !== '') normalized.rir = Number(set.rir);
    return normalized;
  });
  if (/^[0-4]$/.test(state.multi.lastEffort)) sets.at(-1).rir = Number(state.multi.lastEffort);
  return {
    weight: Number(state.multi.weight), unit: state.unit, exercise: state.multi.exercise,
    effort: state.multi.lastEffort === 'near' ? 'last_near_failure' : 'as_entered', sets,
  };
}

function renderMultiResult(result) {
  const [statusLabel, defaultMessage] = STATUS_COPY[result.status] || ['无法计算', '请检查输入。'];
  const reasonMessage = result.reasons.map((reason) => REASON_COPY[reason]).filter(Boolean).join(' ');
  setText('#model-status', statusLabel);
  setText('#model-message', reasonMessage || defaultMessage);
  $('#model-status').dataset.status = result.status;
  renderV3Details(result);
  if (result.stats) {
    setText('#sets-result', `${result.stats.sets} 组`);
    setText('#reps-result', `${result.stats.totalReps} 次`);
    setText('#volume-result', `${displayWeight(result.stats.volumeKgReps).toFixed(1)} ${state.unit}·次`);
    setText('#retention-result', `${Math.round(result.stats.lastToFirstRepRatio * 100)}%`);
  }
  if (!Number.isFinite(result.estimateKg)) {
    renderEmpty();
    renderV3Details(result);
    clearRmTable('当前状态不提供主估算或训练重量表');
    return;
  }
  setText('#main-result', displayWeight(result.estimateKg).toFixed(0));
  setText('#result-range', result.assumptionRangeKg.map((value) => display(value, 0)).join(' ～ '));
  const inputKg = state.unit === 'kg' ? Number(state.multi.weight) : lbToKg(Number(state.multi.weight));
  $('#result-bar-fill').style.width = `${Math.min(100, Math.max(20, result.estimateKg / inputKg * 50))}%`;
  renderRmTable(result.estimateKg);
}

function calculate() {
  setText('#result-title', state.mode === 'multi' ? '预计最大力量 e1RM · 实验版' : '综合预计 1RM');
  setText('#range-label', state.mode === 'multi' ? '假设敏感性范围' : '参考范围');
  if (state.mode === 'single') {
    const validation = validateSet(state.single);
    setText('#single-error', validation.valid ? '' : validation.message);
    if (!validation.valid) { renderEmpty(); updateFormulaList(null); return; }
    const normalized = { ...state.single, weight: state.unit === 'kg' ? Number(state.single.weight) : lbToKg(Number(state.single.weight)) };
    const result = calculateSet(normalized, modelConfig);
    setText('#main-result', display(result.average).split(' ')[0]);
    setText('#result-range', `${display(result.range.min)} ～ ${display(result.range.max)}`);
    $('#result-bar-fill').style.width = `${Math.min(100, Math.max(20, result.average / normalized.weight * 50))}%`;
    updateFormulaList(result);
    renderRmTable(result.average);
    return;
  }
  if (state.multi.weight === '' || state.sets.some((set) => set.reps === '')) {
    setText('#multi-error', '请填写统一重量和每组完成次数');
    renderEmpty();
    clearMultiSummary();
    renderV3Details(null);
    return;
  }
  setText('#multi-error', '');
  renderMultiResult(calculateSession(buildMultiInput()));
}

document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.mode; renderMode(); }));
$('#single-weight').addEventListener('input', (event) => { state.single.weight = event.target.value; calculate(); });
$('#single-reps').addEventListener('input', (event) => { state.single.reps = event.target.value; calculate(); });
$('#multi-weight').addEventListener('input', (event) => { state.multi.weight = event.target.value; calculate(); });
$('#exercise').addEventListener('change', (event) => { state.multi.exercise = event.target.value; calculate(); });
$('#last-effort').addEventListener('change', (event) => { state.multi.lastEffort = event.target.value; calculate(); });
$('#uniform-rest').addEventListener('change', (event) => { state.multi.uniformRest = event.target.value; calculate(); });
$('#advanced-toggle').addEventListener('click', () => { state.multi.advanced = !state.multi.advanced; renderMode(); });
$('#unit').addEventListener('change', (event) => {
  const next = event.target.value;
  if (next === state.unit) return;
  const convert = next === 'kg' ? lbToKg : kgToLb;
  state.single.weight = state.single.weight ? convert(Number(state.single.weight)).toFixed(1) : '';
  state.multi.weight = state.multi.weight ? convert(Number(state.multi.weight)).toFixed(1) : '';
  state.unit = next;
  renderMode();
});
$('#add-set').addEventListener('click', () => {
  if (state.sets.length >= 8) return;
  const previous = state.sets.at(-1);
  state.sets.push({ reps: previous.reps, rir: '', rest: previous.rest });
  renderSets();
  calculate();
});
$('#reset-multi').addEventListener('click', () => {
  state.multi = { weight: '', exercise: 'bench_press', lastEffort: 'near', uniformRest: '5', advanced: false };
  state.sets = [blankSet(), blankSet()];
  renderMode();
});
renderMode();
