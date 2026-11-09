// Два 3D-кубики синьо-жовтих кольорів, що котяться в центрі дошки.
import * as THREE from 'three';
import { tween, Ease } from '../utils/tween.js';

// Порядок граней BoxGeometry: +x, -x, +y, -y, +z, -z
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

/** Обертання, що ставить грань зі значенням v догори. */
function faceUp(v) {
  const q = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  switch (v) {
    case 6: q.setFromAxisAngle(X, Math.PI); break;
    case 2: q.setFromAxisAngle(X, -Math.PI / 2); break;
    case 5: q.setFromAxisAngle(X, Math.PI / 2); break;
    case 3: q.setFromAxisAngle(Z, Math.PI / 2); break;
    case 4: q.setFromAxisAngle(Z, -Math.PI / 2); break;
  }
  return q;
}

function faceTexture(value, bg, pip) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 122);
  ctx.fillStyle = pip;
  for (const [x, y] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(x * 128, y * 128, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Dice {
  constructor(engine) {
    const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const make = (bg, pip) => FACE_VALUES.map((v) => engine.std({ map: faceTexture(v, bg, pip), roughness: 0.35 }));
    this.dice = [make('#0057b7', '#ffd500'), make('#ffd500', '#0057b7')].map((mats, k) => {
      const d = new THREE.Mesh(geo, mats);
      d.castShadow = engine.realtimeShadows; // на «Низьких» — проєктована тінь
      d.receiveShadow = true;
      d.position.set(k ? 0.9 : -0.9, 0.55, 1.2);
      engine.scene.add(d);
      return d;
    });
  }

  roll(a, b) {
    return Promise.all([this.rollOne(this.dice[0], a, -0.9), this.rollOne(this.dice[1], b, 0.9)]);
  }

  rollOne(die, value, x) {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.8);
    const target = yaw.multiply(faceUp(value));
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const spin = 14 + Math.random() * 8;
    const from = new THREE.Vector3(x * 3 + (Math.random() - 0.5) * 2, 4.5, 3.5);
    const to = new THREE.Vector3(x, 0.55, 1.2);
    const q = new THREE.Quaternion();
    return tween(1.25, (_, k) => {
      const e = Ease.outCubic(k);
      die.position.lerpVectors(from, to, e);
      die.position.y = 0.55 + Math.abs(Math.cos(k * Math.PI * 2.5)) * 4 * Math.pow(1 - k, 2);
      // Кут обертання згасає до нуля → кубик плавно «лягає» потрібною гранню
      q.setFromAxisAngle(axis, spin * Math.pow(1 - k, 2));
      die.quaternion.copy(q).multiply(target);
    }, Ease.linear);
  }
}
