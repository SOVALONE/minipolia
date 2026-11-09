// Воксельні частинки: конфетті, іскри (світяться в Bloom) і дим. Пули InstancedMesh.
import * as THREE from 'three';
import { VOXEL_GEOMETRY } from './VoxelBuilder.js';

class Pool {
  constructor(scene, material, max, castShadow) {
    this.mesh = new THREE.InstancedMesh(VOXEL_GEOMETRY, material, max);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.items = Array.from({ length: max }, () => ({ life: 0 }));
    this.next = 0;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) { this.mesh.setMatrixAt(i, zero); this.mesh.setColorAt(i, c); }
    scene.add(this.mesh);
  }

  spawn(p) {
    const i = this.next;
    this.next = (this.next + 1) % this.items.length;
    Object.assign(this.items[i], p, { age: 0 });
    this.mesh.setColorAt(i, new THREE.Color(p.color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
    let dirty = false;
    this.items.forEach((p, i) => {
      if (p.life <= 0) return;
      dirty = true;
      p.age += dt;
      if (p.age >= p.life) { p.life = 0; this.mesh.setMatrixAt(i, m.makeScale(0, 0, 0)); return; }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(1 - p.drag * dt);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.3 && p.gravity > 0) { p.pos.y = 0.3; p.vel.y *= -0.35; p.vel.x *= 0.7; p.vel.z *= 0.7; }
      p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
      const k = p.age / p.life;
      const size = p.size * (p.grow ? 0.6 + k * 1.2 : 1) * (1 - Math.pow(k, 3));
      q.setFromEuler(e.set(p.rot.x, p.rot.y, p.rot.z));
      m.compose(p.pos, q, s.setScalar(size));
      this.mesh.setMatrixAt(i, m);
    });
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const rand = (a, b) => a + Math.random() * (b - a);
const rv = (k) => new THREE.Vector3(rand(-k, k), rand(-k, k), rand(-k, k));

export class Particles {
  constructor(engine) {
    this.confetti = new Pool(engine.scene, engine.materials.solid, 500, engine.realtimeShadows);
    this.sparks = new Pool(engine.scene, engine.materials.glow, 200, false);
    this.smoke = new Pool(engine.scene, engine.std({ color: '#ffffff', roughness: 1 }), 150, false);
  }

  /** Конфетті + іскри + дим — на купівлю нерухомості. */
  burst(pos, colors, { count = 70, power = 6 } = {}) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(0.9, 1.8), rand(-1, 1)).normalize();
      this.confetti.spawn({
        pos: pos.clone().add(rv(0.2)), vel: dir.multiplyScalar(rand(power * 0.5, power)),
        rot: rv(3), spin: rv(10), gravity: 12, drag: 0.6, life: rand(1.4, 2.4),
        size: rand(0.07, 0.13), color: colors[i % colors.length],
      });
    }
    for (let i = 0; i < count / 3; i++) {
      this.sparks.spawn({
        pos: pos.clone(), vel: new THREE.Vector3(rand(-1, 1), rand(1, 2.5), rand(-1, 1)).multiplyScalar(rand(2, 5)),
        rot: rv(3), spin: rv(6), gravity: 3, drag: 1.5, life: rand(0.6, 1.2),
        size: rand(0.04, 0.08), color: '#ffe680',
      });
    }
    this.puff(pos, 10);
  }

  /** Клуби воксельного диму. */
  puff(pos, count = 6, color = '#d9d4cc') {
    for (let i = 0; i < count; i++) {
      this.smoke.spawn({
        pos: pos.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(0, 0.2), rand(-0.4, 0.4))),
        vel: new THREE.Vector3(rand(-0.4, 0.4), rand(0.6, 1.4), rand(-0.4, 0.4)),
        rot: rv(1), spin: rv(1), gravity: -0.3, drag: 1.2, life: rand(1.0, 1.8),
        size: rand(0.18, 0.32), grow: true, color,
      });
    }
  }

  update(dt) {
    this.confetti.update(dt);
    this.sparks.update(dt);
    this.smoke.update(dt);
  }
}
