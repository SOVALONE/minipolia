// Мінімалістична система твінів на промісах. Оновлюється з головного циклу рендера,
// тому анімації синхронні з кадрами і їх зручно `await`-ити в ігровій логіці.

const active = new Set();

export const Ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

/** onUpdate(easedT, rawT) викликається щокадру; повертає Promise, що виконується в кінці. */
export function tween(duration, onUpdate, ease = Ease.inOutCubic) {
  return new Promise((resolve) => {
    active.add({ t: 0, duration: Math.max(duration, 1e-4), onUpdate, ease, resolve });
  });
}

export const wait = (seconds) => tween(seconds, () => {}, Ease.linear);

export function updateTweens(dt) {
  for (const tw of active) {
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.duration);
    tw.onUpdate(tw.ease(k), k);
    if (k >= 1) {
      active.delete(tw);
      tw.resolve();
    }
  }
}

/** Детермінований генератор випадкових чисел для декору (mulberry32). */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
