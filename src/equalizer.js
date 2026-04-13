import { STORAGE } from './state.js';
import { eqPanel, eqLowSlider, eqMidSlider, eqHighSlider } from './dom-refs.js';

let eqLowFilter = null;
let eqMidFilter = null;
let eqHighFilter = null;

function initEQ(audioCtx, sourceNode, analyserNode) {
  eqLowFilter = audioCtx.createBiquadFilter();
  eqLowFilter.type = 'lowshelf';
  eqLowFilter.frequency.value = 200;
  eqLowFilter.gain.value = STORAGE.getEqLow();

  eqMidFilter = audioCtx.createBiquadFilter();
  eqMidFilter.type = 'peaking';
  eqMidFilter.frequency.value = 1000;
  eqMidFilter.Q.value = 1;
  eqMidFilter.gain.value = STORAGE.getEqMid();

  eqHighFilter = audioCtx.createBiquadFilter();
  eqHighFilter.type = 'highshelf';
  eqHighFilter.frequency.value = 8000;
  eqHighFilter.gain.value = STORAGE.getEqHigh();

  // Rewire: source -> low -> mid -> high -> analyser -> destination
  sourceNode.disconnect();
  analyserNode.disconnect();
  sourceNode.connect(eqLowFilter);
  eqLowFilter.connect(eqMidFilter);
  eqMidFilter.connect(eqHighFilter);
  eqHighFilter.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);

  // Sync sliders
  eqLowSlider.value = STORAGE.getEqLow();
  eqMidSlider.value = STORAGE.getEqMid();
  eqHighSlider.value = STORAGE.getEqHigh();
}

function getEqLowFilter() { return eqLowFilter; }

eqLowSlider.addEventListener('input', () => {
  const v = parseFloat(eqLowSlider.value);
  if (eqLowFilter) eqLowFilter.gain.value = v;
  STORAGE.setEqLow(v);
});
eqMidSlider.addEventListener('input', () => {
  const v = parseFloat(eqMidSlider.value);
  if (eqMidFilter) eqMidFilter.gain.value = v;
  STORAGE.setEqMid(v);
});
eqHighSlider.addEventListener('input', () => {
  const v = parseFloat(eqHighSlider.value);
  if (eqHighFilter) eqHighFilter.gain.value = v;
  STORAGE.setEqHigh(v);
});

document.getElementById('eq-btn').addEventListener('click', () => eqPanel.classList.toggle('hidden'));
document.getElementById('eq-close').addEventListener('click', () => eqPanel.classList.add('hidden'));
document.getElementById('eq-reset').addEventListener('click', () => {
  eqLowSlider.value = 0; eqMidSlider.value = 0; eqHighSlider.value = 0;
  if (eqLowFilter) eqLowFilter.gain.value = 0;
  if (eqMidFilter) eqMidFilter.gain.value = 0;
  if (eqHighFilter) eqHighFilter.gain.value = 0;
  STORAGE.setEqLow(0); STORAGE.setEqMid(0); STORAGE.setEqHigh(0);
});

export { initEQ, getEqLowFilter };
