// Процедурний звук на WebAudio — без файлів-асетів.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    const unlock = () => { this.ctx ??= new (window.AudioContext || window.webkitAudioContext)(); };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  tone(freq, dur = 0.12, type = 'sine', vol = 0.15, slideTo = null, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hop() { this.tone(520, 0.07, 'triangle', 0.06, 760); }
  dice() { for (let i = 0; i < 6; i++) this.tone(180 + Math.random() * 200, 0.04, 'square', 0.03, null, i * 0.11); }
  coin() { this.tone(988, 0.08, 'square', 0.05); this.tone(1319, 0.2, 'square', 0.05, null, 0.08); }
  pay() { this.tone(330, 0.15, 'sawtooth', 0.04, 220); }
  buy() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, null, i * 0.08)); }
  card() { this.tone(700, 0.1, 'sine', 0.08, 1100); }
  bad() { this.tone(300, 0.3, 'sawtooth', 0.06, 110); }
  siren() { for (let i = 0; i < 3; i++) { this.tone(420, 0.55, 'sawtooth', 0.05, 820, i * 1.1); this.tone(820, 0.55, 'sawtooth', 0.05, 420, i * 1.1 + 0.55); } }
}
