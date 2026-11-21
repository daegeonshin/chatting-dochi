// 효과음은 파일 없이 직접 합성
let ctx = null;
export function unlockAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
function tone({ f0, f1 = f0, dur = 0.15, type = 'sine', vol = 0.2, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  bat: () => { tone({ f0: 1400, f1: 300, dur: 0.12, type: 'square', vol: 0.12 }); tone({ f0: 180, f1: 90, dur: 0.15, type: 'triangle', vol: 0.15 }); },
  swish: () => tone({ f0: 700, f1: 200, dur: 0.18, type: 'sawtooth', vol: 0.04 }),
  homerun: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f0: f, dur: 0.18, type: 'triangle', vol: 0.12, delay: i * 0.1 })); },
  out: () => { tone({ f0: 330, f1: 220, dur: 0.25, type: 'triangle', vol: 0.12 }); tone({ f0: 220, f1: 160, dur: 0.3, type: 'triangle', vol: 0.1, delay: 0.2 }); },
  pitch: () => tone({ f0: 300, f1: 600, dur: 0.12, type: 'sine', vol: 0.06 }),
  click: () => tone({ f0: 880, f1: 1200, dur: 0.06, vol: 0.08 }),
  jump: () => tone({ f0: 330, f1: 660, dur: 0.16, type: 'triangle', vol: 0.15 }),
  jump2: () => tone({ f0: 520, f1: 1040, dur: 0.2, type: 'triangle', vol: 0.15 }),
  happy: () => { tone({ f0: 660, dur: 0.1, vol: 0.12 }); tone({ f0: 880, dur: 0.12, vol: 0.12, delay: 0.1 }); tone({ f0: 1100, dur: 0.15, vol: 0.1, delay: 0.2 }); },
  eat: () => { for (let i = 0; i < 3; i++) tone({ f0: 300, f1: 200, dur: 0.07, type: 'square', vol: 0.05, delay: i * 0.15 }); },
  door: () => tone({ f0: 200, f1: 120, dur: 0.25, type: 'triangle', vol: 0.15 }),
  place: () => tone({ f0: 500, f1: 300, dur: 0.1, type: 'triangle', vol: 0.12 }),
  // 까치 : 짧은 깍깍
  magpie: (vol = 0.12) => {
    for (let i = 0; i < 2; i++) {
      tone({ f0: 1500, f1: 1100, dur: 0.08, type: 'sawtooth', vol: vol * 0.6, delay: i * 0.16 });
      tone({ f0: 2300, f1: 1800, dur: 0.07, type: 'square', vol: vol * 0.3, delay: i * 0.16 });
    }
  },
  tweet: (vol = 0.06) => { tone({ f0: 3000, f1: 4200, dur: 0.06, vol, delay: 0 }); tone({ f0: 3200, f1: 4400, dur: 0.05, vol, delay: 0.09 }); },
  quack: (vol = 0.1) => tone({ f0: 420, f1: 260, dur: 0.14, type: 'sawtooth', vol }),
  splash: () => tone({ f0: 900, f1: 150, dur: 0.25, type: 'triangle', vol: 0.06 }),
  sleep: () => { tone({ f0: 523, dur: 0.4, vol: 0.1 }); tone({ f0: 392, dur: 0.4, vol: 0.1, delay: 0.4 }); tone({ f0: 330, dur: 0.7, vol: 0.1, delay: 0.8 }); },
  morning: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, dur: 0.25, vol: 0.1, delay: i * 0.15 })); },
  bark: () => { tone({ f0: 500, f1: 300, dur: 0.1, type: 'sawtooth', vol: 0.08 }); tone({ f0: 520, f1: 300, dur: 0.1, type: 'sawtooth', vol: 0.08, delay: 0.18 }); },
  meow: () => tone({ f0: 700, f1: 500, dur: 0.35, type: 'triangle', vol: 0.1 }),
  plane: () => tone({ f0: 120, f1: 180, dur: 0.5, type: 'sawtooth', vol: 0.04 }),
};
