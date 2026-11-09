// Воксельні фішки гравців із підставкою кольору гравця та анімаціями стрибків.
import * as THREE from 'three';
import { VoxelModel } from './VoxelBuilder.js';
import { tween, Ease } from '../utils/tween.js';

const FIGURES = {
  cat(m) {
    const fur = '#f0a04b', dark = '#c97a2c';
    for (const [x, z] of [[-1, -2], [1, -2], [-1, 1], [1, 1]]) m.set(x, 0, z, fur);
    m.box(-1, 1, -2, 1, 2, 1, (x, y, z) => (z % 2 ? dark : fur));
    m.box(-1, 3, 0, 1, 5, 2, fur);
    m.set(-1, 6, 1, fur).set(1, 6, 1, fur);
    m.set(-1, 4, 2, '#1b1b1b').set(1, 4, 2, '#1b1b1b');
    m.set(0, 2, -3, dark).set(0, 3, -3, dark).set(0, 4, -4, dark);
  },
  tractor(m) {
    const body = '#2e7d32', black = '#1a1a1a';
    m.box(-1, 1, -2, 1, 2, 2, body);
    m.box(-1, 3, -2, 1, 5, -1, body, { windows: '#bfe8ff', dense: true });
    m.box(-1, 6, -2, 1, 6, -1, '#ffd500');
    m.box(-2, 0, -2, -2, 2, -1, black).box(2, 0, -2, 2, 2, -1, black);
    m.box(-2, 0, 1, -2, 1, 2, black).box(2, 0, 1, 2, 1, 2, black);
    m.set(0, 3, 1, '#555555').set(0, 4, 1, '#555555');
    m.set(0, 2, 3, '#fff6c0', true);
  },
  drone(m) {
    const khaki = '#5b6b3a';
    m.box(-1, 2, -1, 1, 3, 1, khaki);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      m.set(sx * 2, 3, sz * 2, '#333333');
      m.box(sx * 3 - 1, 4, sz * 3 - 1, sx * 3 + 1, 4, sz * 3 + 1, '#222222');
    }
    m.set(0, 1, 0, '#222222');
    m.set(-1, 2, 2, '#ff3030', true).set(1, 2, 2, '#30ff60', true);
    m.set(0, 4, 0, '#ffd500').set(0, 4, 1, '#0057b7');
  },
  dog(m) {
    const w = '#f5f5f5', br = '#8b5a2b';
    for (const [x, z] of [[-1, -2], [1, -2], [-1, 1], [1, 1]]) m.set(x, 0, z, w);
    m.box(-1, 1, -2, 1, 2, 1, w);
    m.box(-1, 2, -1, 1, 2, 0, '#6b7b3a'); // жилет сапера
    m.box(-1, 3, 1, 1, 5, 3, w);
    m.set(-1, 5, 2, br).set(1, 5, 2, br).set(-1, 6, 2, br).set(1, 6, 2, br);
    m.set(-1, 4, 3, br).set(0, 3, 4, '#111111');
    m.set(0, 2, -3, br).set(0, 3, -3, br);
  },
};

export class Token {
  constructor(engine, player) {
    this.player = player;
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.08, 24), engine.std({ color: player.color, roughness: 0.4, metalness: 0.2 }));
    base.position.y = 0.04;
    base.castShadow = engine.realtimeShadows;
    base.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(player.color).multiplyScalar(2.2) }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    this.inner.add(base, ring);

    const vm = new VoxelModel(0.075);
    (FIGURES[player.token] ?? FIGURES.cat)(vm);
    const fig = vm.build(engine.materials, { center: 'xz', castShadow: engine.realtimeShadows });
    fig.position.y = 0.08;
    this.inner.add(fig);

    engine.scene.add(this.root);
    this.idlePhase = Math.random() * 10;
  }

  place(pos) { this.root.position.copy(pos); }

  faceTowards(target) {
    const d = target.clone().sub(this.root.position);
    if (d.lengthSq() > 1e-4) this.root.rotation.y = Math.atan2(d.x, d.z);
  }

  /** Один стрибок на нову позицію зі сквош-стретч. */
  hopTo(target, { duration = 0.24, height = 0.8 } = {}) {
    const from = this.root.position.clone();
    this.faceTowards(target);
    return tween(duration, (t, raw) => {
      this.root.position.lerpVectors(from, target, t);
      this.root.position.y = THREE.MathUtils.lerp(from.y, target.y, t) + Math.sin(raw * Math.PI) * height;
      const s = raw < 0.15 ? 1 - raw * 1.2 : raw > 0.85 ? 1 - (1 - raw) * 1.2 : 1.12;
      this.inner.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }, Ease.linear).then(() => this.inner.scale.set(1, 1, 1));
  }

  /** Великий стрибок-переліт (бус, укриття). */
  flyTo(target, duration = 1.0) {
    return this.hopTo(target, { duration, height: 4 });
  }

  update(dt, time, active) {
    // Активна фішка легенько підстрибує на місці
    const amp = active ? 0.06 : 0;
    this.inner.position.y = Math.abs(Math.sin(time * 4 + this.idlePhase)) * amp;
  }

  setVisible(v) { this.root.visible = v; }
}
