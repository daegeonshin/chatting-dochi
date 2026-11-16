import { sfx } from './audio.js';

const $ = id => document.getElementById(id);
export { $ };

let toastT = null;
export function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), ms);
}

export function openPanel(title, build) {
  sfx.click();
  $('panel-title').textContent = title;
  const body = $('panel-body');
  body.innerHTML = '';
  build(body);
  $('panel').classList.remove('hidden');
}
export function closePanel() { $('panel').classList.add('hidden'); }
$('panel-close').addEventListener('click', closePanel);
$('panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') closePanel(); });

// 이름 입력 창
export function prompt(title, value = '') {
  return new Promise(res => {
    $('modal-title').textContent = title;
    const inp = $('modal-input');
    inp.value = value;
    $('modal').classList.remove('hidden');
    setTimeout(() => inp.focus(), 50);
    const done = v => {
      $('modal').classList.add('hidden');
      $('modal-ok').onclick = $('modal-cancel').onclick = inp.onkeydown = null;
      res(v);
    };
    $('modal-ok').onclick = () => done(inp.value.trim() || null);
    $('modal-cancel').onclick = () => done(null);
    inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value.trim() || null); };
  });
}

// 화면 전환 (어둡게 했다가 밝게)
export function transition(cb, text = '', hold = 350) {
  const f = $('fade');
  f.textContent = text;
  f.classList.add('on');
  return new Promise(res => {
    setTimeout(() => {
      cb();
      setTimeout(() => { f.classList.remove('on'); res(); }, hold);
    }, 750);
  });
}

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
export const hexCss = h => '#' + h.toString(16).padStart(6, '0');
