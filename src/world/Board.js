// Ігрова дошка: основа, 40 клітинок із підписами, воксельні будівлі, центр із декором,
// прапорці власників і філії. Відповідає за координати клітинок і слотів фішок.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VoxelModel } from './VoxelBuilder.js';
import { MODELS, CORNERS } from './models.js';
import { TILES, GROUPS } from '../game/data/tiles.js';
import { DECKS } from '../game/data/cards.js';
import { CONFIG, fmt } from '../config.js';
import { seeded, tween, Ease } from '../utils/tween.js';

const TS = CONFIG.tileSize;
const TOP = CONFIG.tileTop;
const HALF = 5; // клітинок від центру до кута
const SIDE_ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
const CORNER_MODEL = { 0: 'start', 10: 'tck', 20: 'shelter', 30: 'bus' };

export class Board {
  constructor(engine) {
    this.engine = engine;
    this.root = new THREE.Group();
    engine.scene.add(this.root);
    this.tileGroups = [];
    this.parts = [];          // анімовані частини { obj, kind, phase }
    this.flags = {};          // tile -> Object3D
    this.houses = {};         // tile -> Group
    this.buildings = {};      // tile -> Group (для «поп»-анімації)

    this.buildBase();
    this.buildTiles();
    this.buildCenter();
  }

  // ───────────── координати ─────────────
  static side(i) { return Math.floor(i / 10) % 4; }
  static isCorner(i) { return i % 10 === 0; }

  tilePos(i) {
    let gx, gz;
    if (i <= 10) { gx = HALF - i; gz = HALF; }
    else if (i <= 20) { gx = -HALF; gz = HALF - (i - 10); }
    else if (i <= 30) { gx = -HALF + (i - 20); gz = -HALF; }
    else { gx = HALF; gz = -HALF + (i - 30); }
    return new THREE.Vector3(gx * TS, TOP, gz * TS);
  }

  /** Локальна точка клітинки → світові координати. */
  local(i, x, y, z) {
    const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), SIDE_ROT[Board.side(i)]);
    return v.add(this.tilePos(i));
  }

  /** Місце фішки гравця на клітинці (4 слоти у внутрішній половині). */
  slotPos(i, slot) {
    const s = slot % 4;
    if (Board.isCorner(i)) return this.local(i, [-0.85, -0.3, 0.25, 0.8][s], 0.02, -0.6);
    return this.local(i, s % 2 ? 0.52 : -0.52, 0.02, s < 2 ? -0.78 : -0.26);
  }

  // ───────────── основа ─────────────
  buildBase() {
    const e = this.engine;
    const size = TS * 11 + 1.2;
    const base = new THREE.Mesh(new RoundedBoxGeometry(size, 0.6, size, 3, 0.25), e.std({ color: '#5b3f2a', roughness: 0.9 }));
    base.position.y = -0.3;
    base.receiveShadow = base.castShadow = true;
    this.root.add(base);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(320, 48), e.std({ color: '#5d8040', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    this.root.add(ground);
  }

  buildTiles() {
    const e = this.engine;
    const plates = new THREE.InstancedMesh(new RoundedBoxGeometry(TS - 0.1, TOP, TS - 0.1, 2, 0.06), e.std({ roughness: 0.85 }), 40);
    plates.receiveShadow = plates.castShadow = true;
    const stripeIdx = TILES.map((t, i) => (t.group ? i : -1)).filter((i) => i >= 0);
    const stripes = new THREE.InstancedMesh(new RoundedBoxGeometry(TS - 0.2, 0.08, 0.26, 2, 0.03), e.std({ roughness: 0.6 }), stripeIdx.length);
    stripes.receiveShadow = true;

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    TILES.forEach((tile, i) => {
      const p = this.tilePos(i);
      q.setFromAxisAngle(up, SIDE_ROT[Board.side(i)]);
      m.compose(new THREE.Vector3(p.x, TOP / 2, p.z), q, new THREE.Vector3(1, 1, 1));
      plates.setMatrixAt(i, m);
      plates.setColorAt(i, c.set(Board.isCorner(i) ? '#efe2c4' : i % 2 ? '#f6ecd6' : '#f1e5cb'));

      const g = new THREE.Group();
      g.position.copy(p);
      g.rotation.y = SIDE_ROT[Board.side(i)];
      this.root.add(g);
      this.tileGroups[i] = g;

      this.addLabel(g, tile, i);
      this.addModel(g, tile, i);
    });
    stripeIdx.forEach((i, k) => {
      const pos = this.local(i, 0, TOP + 0.03, -1.0);
      q.setFromAxisAngle(up, SIDE_ROT[Board.side(i)]);
      m.compose(pos, q, new THREE.Vector3(1, 1, 1));
      stripes.setMatrixAt(k, m);
      stripes.setColorAt(k, c.set(GROUPS[TILES[i].group].color));
    });
    plates.userData.isTilePicker = true;
    this.plates = plates;
    this.root.add(plates, stripes);
  }

  addLabel(group, tile, i) {
    const corner = Board.isCorner(i);
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = corner ? 200 : 220;
    const ctx = cv.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const deck = DECKS[tile.type];

    const fit = (text, weight, size, family, maxW) => {
      let s = size;
      do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 18);
    };
    ctx.fillStyle = deck ? deck.color : '#2a2018';
    fit(tile.name.toUpperCase(), 800, corner ? 64 : 56, 'Unbounded, Inter, sans-serif', 480);
    ctx.fillText(tile.name.toUpperCase(), 256, cv.height * 0.38);

    let sub = '';
    if (tile.price) sub = fmt(tile.price);
    else if (tile.type === 'tax') sub = `сплати ${fmt(tile.amount)}`;
    else if (deck) sub = 'тягни картку';
    else if (tile.type === 'start') sub = `+${fmt(CONFIG.passStartBonus)}`;
    else if (tile.type === 'tck') sub = 'блокпост';
    else if (tile.type === 'bus') sub = 'бусифікація';
    else if (tile.type === 'shelter') sub = 'безпечна зона';
    ctx.fillStyle = '#5a4a3a';
    ctx.font = `600 40px Inter, sans-serif`;
    ctx.fillText(sub, 256, cv.height * 0.76);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const w = TS - 0.2;
    const h = corner ? 0.8 : 0.82;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      this.engine.std({ map: tex, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.006, corner ? -0.62 : -0.47);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  addModel(group, tile, i) {
    const vm = new VoxelModel(CONFIG.voxel);
    const parts = [];
    const ctx = {
      m: vm,
      brand: tile.brand ?? '#888888',
      part: (name, model, pos) => parts.push({ name, model, pos }),
    };
    if (Board.isCorner(i)) CORNERS[CORNER_MODEL[i]](ctx);
    else if (DECKS[tile.type]) MODELS.card({ ...ctx, deckColor: DECKS[tile.type].color, icon: DECKS[tile.type].icon });
    else if (tile.type === 'tax') MODELS.tax(ctx);
    else MODELS[tile.model](ctx);

    const building = vm.build(this.engine.materials);
    group.add(building);
    this.buildings[i] = building;

    for (const p of parts) {
      const obj = p.model.build(this.engine.materials, { center: p.name === 'glyph' ? 'xz' : null });
      const holder = new THREE.Group();
      holder.position.set(p.pos[0] * CONFIG.voxel, p.pos[1] * CONFIG.voxel, p.pos[2] * CONFIG.voxel);
      holder.add(obj);
      if (p.name === 'glyph') obj.position.y = -0.3;
      group.add(holder);
      this.parts.push({ obj: holder, kind: p.name, phase: i * 0.7 });
    }
  }

  // ───────────── центр дошки ─────────────
  buildCenter() {
    const e = this.engine;
    const rnd = seeded(2024);
    const n = 36, cell = 0.6, start = -10.5;
    const carpet = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), e.materials.solid, n * n);
    carpet.receiveShadow = true;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const zones = [];
    let k = 0;
    for (let ix = 0; ix < n; ix++)
      for (let iz = 0; iz < n; iz++) {
        const x = start + ix * cell, z = start + iz * cell;
        let h = 0.12 + rnd() * 0.06, col;
        const lake = Math.hypot(x + 6.2, z + 6.2) < 3.6;
        if (Math.abs(x) < 4.2 && Math.abs(z) < 4.2) { col = rnd() > 0.5 ? '#d8ccb0' : '#d2c5a6'; h = 0.1; }
        else if (lake) { col = rnd() > 0.7 ? '#4aa3e8' : '#2f86d6'; h = 0.04; }
        else if (x < -3 && z > 3) col = ['#e3c25a', '#d9b44a', '#ecd06c'][Math.floor(rnd() * 3)];
        else col = ['#6aa84f', '#5f9a45', '#77b55a', '#5a8f40'][Math.floor(rnd() * 4)];
        m.makeScale(cell * 0.97, h * 2, cell * 0.97).setPosition(x, 0, z);
        carpet.setMatrixAt(k, m);
        carpet.setColorAt(k++, c.set(col));
        zones.push({ x, z, lake });
      }
    carpet.computeBoundingSphere();
    this.root.add(carpet);

    // Декор: соняшники, хатки, дерева (воксель 0.3)
    const D = new VoxelModel(0.3);
    const vx = (w) => Math.round(w / 0.3);
    for (let x = 4.6; x < 10; x += 0.9)
      for (let z = 4.6; z < 10; z += 0.9) {
        const X = vx(x), Z = vx(z);
        D.set(X, 0, Z, '#3f8f3a').set(X, 1, Z, '#3f8f3a').set(X, 2, Z, rnd() > 0.15 ? '#ffcc00' : '#ffb300');
      }
    const hut = (X, Z) => {
      D.box(X, 0, Z, X + 3, 1, Z + 2, '#f7f3ea', { windows: '#ffd36b' });
      D.box(X - 1, 2, Z - 1, X + 4, 2, Z + 3, '#c9a24a');
      D.box(X, 3, Z, X + 3, 3, Z + 2, '#b8913d');
    };
    hut(vx(5), vx(-9.5)); hut(vx(8), vx(-7)); hut(vx(5.2), vx(-5.5));
    const tree = (X, Z, h) => {
      for (let y = 0; y < h; y++) D.set(X, y, Z, '#6d4c33');
      D.box(X - 1, h, Z - 1, X + 1, h + 2, Z + 1, rnd() > 0.5 ? '#2e7d32' : '#388e3c');
      D.set(X, h + 3, Z, '#43a047');
    };
    for (let t = 0; t < 26; t++) {
      const x = -10 + rnd() * 20, z = -10 + rnd() * 20;
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      if (x > 4 && z > 4) continue;                  // поле соняшників
      if (x < -2.5 && z > 2.5) continue;             // пшениця
      if (Math.hypot(x + 6.2, z + 6.2) < 4) continue; // озеро
      if (x > 4 && z < -4 && x < 10) continue;       // село
      tree(vx(x), vx(z), 2 + Math.floor(rnd() * 2));
    }
    // Човник на озері
    D.box(vx(-6.5), 0, vx(-6.2), vx(-5.6), 0, vx(-5.9), '#8d5a3b');
    const decor = D.build(e.materials);
    decor.position.y = 0.18;
    this.root.add(decor);

    // Назва гри на центральній площі
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 150px Unbounded, Inter, sans-serif';
    const grad = ctx.createLinearGradient(0, 40, 0, 200);
    grad.addColorStop(0, '#0057b7'); grad.addColorStop(0.5, '#0057b7');
    grad.addColorStop(0.5, '#ffd500'); grad.addColorStop(1, '#ffd500');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(30,20,10,0.55)';
    ctx.lineWidth = 8;
    ctx.strokeText('МІНІПОЛІЯ', 512, 128);
    ctx.fillText('МІНІПОЛІЯ', 512, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const title = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), e.std({ map: tex, transparent: true, roughness: 0.7 }));
    title.rotation.x = -Math.PI / 2;
    title.position.set(0, 0.24, -2.6);
    title.receiveShadow = true;
    this.root.add(title);
  }

  // ───────────── власність ─────────────
  setOwner(i, color) {
    const g = this.tileGroups[i];
    if (this.flags[i]) { g.remove(this.flags[i]); this.flags[i] = null; }
    if (!color) return;
    const f = new VoxelModel(0.08);
    for (let y = 0; y <= 9; y++) f.set(0, y, 0, '#5d4037');
    f.box(1, 6, 0, 4, 9, 0, color);
    const flag = f.build(this.engine.materials);
    flag.position.set(-1.05, 0, -0.02);
    g.add(flag);
    this.flags[i] = flag;
    flag.scale.setScalar(0.01);
    tween(0.6, (t) => flag.scale.setScalar(Math.max(0.01, t)), Ease.outBack);
  }

  setLevel(i, level) {
    const g = this.tileGroups[i];
    if (this.houses[i]) g.remove(this.houses[i]);
    const holder = new THREE.Group();
    for (let k = 0; k < level; k++) {
      const h = new VoxelModel(0.09);
      h.box(0, 0, 0, 3, 2, 2, '#fafafa', { windows: '#ffd36b' });
      h.box(0, 3, 0, 3, 3, 2, '#c62828');
      h.box(1, 4, 1, 2, 4, 1, '#c62828');
      const obj = h.build(this.engine.materials, { center: 'xz' });
      obj.position.set(-0.6 + k * 0.6, 0.08, -1.0);
      holder.add(obj);
      if (k === level - 1) {
        obj.scale.setScalar(0.01);
        tween(0.7, (t) => obj.scale.setScalar(Math.max(0.01, t)), Ease.outElastic);
      }
    }
    g.add(holder);
    this.houses[i] = holder;
  }

  /** Стрибок будівлі при купівлі. */
  popBuilding(i) {
    const b = this.buildings[i];
    if (!b) return;
    return tween(0.8, (t, raw) => {
      const s = 1 + Math.sin(raw * Math.PI) * 0.25 * (1 - raw);
      b.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    }, Ease.linear);
  }

  update(dt, time) {
    for (const p of this.parts) {
      if (p.kind === 'blades') p.obj.rotation.z += dt * 1.6;
      else if (p.kind === 'glyph') {
        p.obj.rotation.y = time * 1.2 + p.phase;
        p.obj.position.y = 4 * CONFIG.voxel + Math.sin(time * 2 + p.phase) * 0.08;
      }
    }
  }

  /** Індекс клітинки під променем (для підказок при кліку). */
  pick(raycaster) {
    const hit = raycaster.intersectObject(this.plates, false)[0];
    return hit ? hit.instanceId : -1;
  }
}
