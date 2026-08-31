import { FORMULAS, DEFAULT_FORMULA_CONFIG, calculateSet, calculateMultiSet, validateSet, buildRmTable, kgToLb, lbToKg, roundWeight } from './rm-core.js';

const state = {
  mode: 'single', unit: 'kg', rounding: 0.1, single: { weight: '', reps: '' },
  sets: [{ weight: '', reps: '', rir: 0, rest: '' }],
};
state.rounding = 0.1;
state.sets = state.sets.map(({ warmup, ...set }) => set);
const $ = (selector) => document.querySelector(selector);
const modelConfig = DEFAULT_FORMULA_CONFIG;
const unitLabel = () => state.unit;
const displayWeight = (kg) => roundWeight(state.unit === 'kg' ? kg : kgToLb(kg), Number(state.rounding));
const display = (kg, decimals = 1) => Number.isFinite(kg) ? `${displayWeight(kg).toFixed(decimals)} ${unitLabel()}` : '—';
function setText(selector, value) { $(selector).textContent = value; }

function renderMode() {
  document.querySelectorAll('.mode').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
  $('#single-panel').classList.toggle('hidden', state.mode !== 'single');
  $('#multi-panel').classList.toggle('hidden', state.mode !== 'multi');
  $('#multi-summary').classList.toggle('hidden', state.mode !== 'multi');
  $('#single-weight').value = state.single.weight;
  $('#single-reps').value = state.single.reps;
  $('#unit').value = state.unit;
  $('#single-weight-unit').textContent = state.unit;
  setText('#main-unit', state.unit);
  renderSets();
  calculate();
}

function renderSets() {
  $('#set-list').innerHTML = state.sets.map((set, index) => `<div class="set-row" data-index="${index}">
    <div class="set-index">${String(index + 1).padStart(2, '0')}</div>
    <label>重量 <input data-field="weight" type="number" min="0" step="0.1" value="${set.weight}" placeholder="请输入"></label>
    <label>次数 <input data-field="reps" type="number" min="1" max="30" step="1" value="${set.reps}" placeholder="请输入"></label>
    <label>RIR <select data-field="rir">${[0,1,2,3,4,5].map((value) => `<option value="${value}" ${Number(set.rir ?? 0) === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
    <label>休息(分) <select data-field="rest"><option value="" ${set.rest === '' || set.rest === undefined ? 'selected' : ''}>请输入</option>${[1,2,3,4,5].map((value) => `<option value="${value}" ${Number(set.rest) === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
    <button class="remove" aria-label="删除第${index + 1}组" data-action="remove">×</button>
  </div>`).join('');
  document.querySelectorAll('.set-row input,.set-row select').forEach((input) => input.addEventListener('input', onSetInput));
  document.querySelectorAll('[data-action="remove"]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.closest('.set-row').dataset.index); if (state.sets.length > 1) state.sets.splice(index, 1); renderSets(); calculate();
  }));
}

function onSetInput(event) {
  const row = event.target.closest('.set-row'); const index = Number(row.dataset.index); const field = event.target.dataset.field;
  state.sets[index][field] = field === 'warmup' ? event.target.checked : event.target.value;
  calculate();
}

function updateFormulaList(result, multi = false) {
  const formulas = result?.formulas || {};
  $('#formula-list').innerHTML = Object.entries(FORMULAS).filter(([key]) => modelConfig.enabled[key]).map(([key, formula]) => `<div class="formula-line"><span>${formula.label}</span><b>${formulas[key] ? display(formulas[key]) : '无效'}</b></div>`).join('') + (result ? `<div class="formula-line average"><span>${multi ? '本组综合平均' : '综合平均'}</span><b>${display(result.average)}</b></div>` : '');
}

function renderRmTable(oneRm) {
  const common = new Set([5, 8, 10, 12]);
  $('#rm-table').innerHTML = buildRmTable(oneRm, 0.01).map(({ rm, percentage, weight }) => `<tr class="${common.has(rm) ? 'common-rm' : ''}"><td>${rm}RM</td><td>${Math.round(percentage * 100)}%</td><td>${display(weight)}</td></tr>`).join('');
}

function renderEmpty() {
  setText('#main-result', '—'); setText('#result-range', '—'); $('#result-bar-fill').style.width = '0%'; updateFormulaList(null); $('#rm-table').innerHTML = '<tr><td colspan="3" class="muted">输入有效数据后生成训练重量</td></tr>';
}

function calculate() {
  const source = state.mode === 'single' ? state.single : state.sets[0];
  const validation = validateSet(source);
  const errorSelector = state.mode === 'single' ? '#single-error' : '#multi-error'; setText(errorSelector, validation.valid ? '' : validation.message);
  if (state.mode === 'multi') $('#add-set').disabled = !validation.valid;
  if (!validation.valid) { renderEmpty(); if (state.mode === 'multi') { setText('#base-result', '—'); setText('#multi-result', '—'); setText('#volume-result', '—'); } return; }
  if (state.mode === 'single') {
    const normalized = { ...source, weight: state.unit === 'kg' ? Number(source.weight) : lbToKg(Number(source.weight)) };
    const result = calculateSet(normalized, modelConfig); setText('#main-result', display(result.average).split(' ')[0]); setText('#result-range', `${display(result.range.min)} ～ ${display(result.range.max)}`); $('#result-bar-fill').style.width = `${Math.min(100, Math.max(20, result.average / normalized.weight * 50))}%`; updateFormulaList(result); renderRmTable(result.average);
  } else {
    const multi = calculateMultiSet(state.sets.map((set) => ({ ...set, weight: state.unit === 'kg' ? Number(set.weight) : lbToKg(Number(set.weight)), warmup: false })), { formulaConfig: modelConfig });
    if (multi.error) { renderEmpty(); return; }
    const best = multi.sets.reduce((a, b) => a.result.average > b.result.average ? a : b); setText('#main-result', display(multi.multiEstimate).split(' ')[0]); setText('#result-range', `${display(Math.min(...multi.sets.map((set) => set.result.range.min)))} ～ ${display(Math.max(...multi.sets.map((set) => set.result.range.max)))}`); $('#result-bar-fill').style.width = `${Math.min(100, multi.multiEstimate / multi.baseEstimate * 72)}%`; updateFormulaList(best.result, true); renderRmTable(multi.multiEstimate); setText('#base-result', display(multi.baseEstimate)); setText('#multi-result', display(multi.multiEstimate)); setText('#volume-result', `${displayWeight(multi.stats.volume).toFixed(1)} ${state.unit}`); setText('#sets-bonus', `+${(multi.bonuses.sets * 100).toFixed(1)}%`); setText('#rest-bonus', `+${(multi.bonuses.rest * 100).toFixed(1)}%`); setText('#consistency-bonus', `+${(multi.bonuses.consistency * 100).toFixed(1)}%`);
  }
}

document.querySelectorAll('.mode').forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.mode; renderMode(); }));
$('#single-weight').addEventListener('input', (event) => { state.single.weight = event.target.value; calculate(); });
$('#single-reps').addEventListener('input', (event) => { state.single.reps = event.target.value; calculate(); });
$('#unit').addEventListener('change', (event) => { const next = event.target.value; if (next !== state.unit) { const convert = next === 'kg' ? lbToKg : kgToLb; state.single.weight = state.single.weight ? convert(Number(state.single.weight)).toFixed(1) : ''; state.sets = state.sets.map((set) => ({ ...set, weight: set.weight ? convert(Number(set.weight)).toFixed(1) : '' })); state.unit = next; renderMode(); } });
$('#add-set').addEventListener('click', () => { if (!validateSet(state.sets[0]).valid) return; state.sets.push({ ...state.sets[0], rir: '' }); renderSets(); calculate(); });
$('#reset-multi').addEventListener('click', () => { state.sets = [{ weight: '', reps: '', rir: 0, rest: '' }]; renderSets(); calculate(); });
renderMode();
