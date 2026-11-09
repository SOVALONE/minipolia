// Воксельний конструктор: збирає модель із цілочисельних координат і рендерить її
// одним-двома InstancedMesh із кубиками з фаскою (м'які грані, гарно ловлять SSAO).
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { CONFIG } from '../config.js';

/** Куб із фаскою: опукла оболонка 24 точок (±h, ±i, ±i) — лише 44 трикутники на воксель. */
function chamferCube(bevel = 0.09) {
  const h = 0.5, i = 0.5 - bevel, pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(new THREE.Vector3(sx * h, sy * i, sz * i), new THREE.Vector3(sx * i, sy * h, sz * i), new THREE.Vector3(sx * i, sy * i, sz * h));
  }
  return new ConvexGeometry(pts);
}

export const VOXEL_GEOMETRY = chamferCube();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

export class VoxelModel {
  constructor(unit) {
    this.unit = unit;
    this.cells = new Map(); // "x,y,z" -> [x,y,z,color,glow]
  }

  set(x, y, z, color, glow = false) {
    this.cells.set(`${x},${y},${z}`, [x, y, z, color, glow]);
    return this;
  }

  /**
   * Прямокутний блок (межі включно).
   * opts.hollow  — не створювати невидимі внутрішні вокселі (за замовчуванням true)
   * opts.windows — колір вікон-вокселів на бічних гранях (світяться вночі)
   * opts.dense   — суцільне скління (для IT-веж)
   * opts.glow    — увесь блок світиться
   */
  box(x0, y0, z0, x1, y1, z1, color, opts = {}) {
    const { hollow = true, windows = null, dense = false, glow = false } = opts;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const edgeX = x === x0 || x === x1, edgeY = y === y0 || y === y1, edgeZ = z === z0 || z === z1;
          if (hollow && !edgeX && !edgeY && !edgeZ) continue;
          const side = (edgeX || edgeZ) && !edgeY;
          const corner = edgeX && edgeZ;
          const col = typeof color === 'function' ? color(x, y, z) : color;
          if (windows && side && !corner && y % 2 === 1 && (dense || (x + z) % 2 === 0)) this.set(x, y, z, windows, true);
          else this.set(x, y, z, col, glow);
        }
    return this;
  }

  /** Вертикальний «циліндр» із вокселів. */
  cylinder(cx, cz, r, y0, y1, color, opts = {}) {
    for (let y = y0; y <= y1; y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x++)
        for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r); z++) {
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
          if (d > r) continue;
          if (d < r - 1.1 && y !== y0 && y !== y1) continue;
          this.set(x, y, z, typeof color === 'function' ? color(x, y, z) : color, opts.glow);
        }
    return this;
  }

  /** Плаский гліф із рядків ('#' — воксель) у площині XY, товщина 2. */
  glyph(rows, color, { glow = true, depth = 2 } = {}) {
    const h = rows.length, w = rows[0].length;
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch !== '#') return;
        for (let z = 0; z < depth; z++) this.set(rx - Math.floor(w / 2), h - 1 - ry, z - Math.floor(depth / 2), color, glow);
      })
    );
    return this;
  }

  /**
   * Побудувати THREE.Group. center: 'xz' — центрувати по горизонталі (для фішок).
   */
  /**
   * Запечене затінення (AO) одного вокселя за сусідами — дешева заміна SSAO без постобробки.
   * Багато сусідів і накриття зверху → темніше; ребра та кути → світліші (ефект фаски).
   */
  bakedAO(x, y, z) {
    const has = (dx, dy, dz) => this.cells.has(`${x + dx},${y + dy},${z + dz}`);
    let n = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) if ((dx || dy || dz) && has(dx, dy, dz)) n++;
    let ao = 1 - n * 0.03;
    if (has(0, 1, 0)) ao -= 0.1;   // накритий зверху
    if (y === 0) ao -= 0.08;       // контакт із землею
    return Math.min(1, Math.max(0.55, ao));
  }

  build(materials, { center = null, castShadow = true } = {}) {
    const group = new THREE.Group();
    const cells = [...this.cells.values()];
    let off = [0, 0, 0];
    if (center && cells.length) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const c of cells) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], c[k]); max[k] = Math.max(max[k], c[k]); }
      off = [-(min[0] + max[0] + 1) / 2, -min[1], -(min[2] + max[2] + 1) / 2];
    }
    const u = this.unit;
    for (const glow of [false, true]) {
      const list = cells.filter((c) => c[4] === glow);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(VOXEL_GEOMETRY, glow ? materials.glow : materials.solid, list.length);
      list.forEach(([x, y, z, col], i) => {
        _m.makeScale(u, u, u).setPosition((x + 0.5 + off[0]) * u, (y + 0.5 + off[1]) * u, (z + 0.5 + off[2]) * u);
        mesh.setMatrixAt(i, _m);
        _c.set(col);
        if (CONFIG.gfx.bakedAO && !glow) _c.multiplyScalar(this.bakedAO(x, y, z));
        mesh.setColorAt(i, _c);
      });
      mesh.castShadow = castShadow && !glow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    return group;
  }
}
