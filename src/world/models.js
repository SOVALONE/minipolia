// Процедурні воксельні моделі секторів. Кожна функція отримує ctx:
//   ctx.m      — VoxelModel будівлі (локальні координати клітинки)
//   ctx.brand  — фірмовий колір
//   ctx.part(name, model, [x,y,z]) — окрема анімована частина (лопаті, гліфи)
// Система координат клітинки: x ∈ [-6..6] уздовж краю, z ∈ [0..6] — зовнішня половина
// (z росте назовні від центру дошки), y — вгору. Внутрішня половина — під підпис.
import { VoxelModel } from './VoxelBuilder.js';
import { CONFIG } from '../config.js';

const U = CONFIG.voxel;
const WHITE = '#f3efe6', GLASS = '#a8e0ff', WARM = '#ffe29a', ROOF = '#5a4636', CONCRETE = '#a3a39b';

export const MODELS = {
  // Агрохолдинг: червона клуня, силос, соняшники
  agro({ m, brand }) {
    m.box(-6, 0, 1, -2, 3, 5, '#b5452f', { windows: WARM });
    m.box(-6, 4, 1, -2, 4, 5, ROOF);
    m.box(-5, 5, 2, -3, 5, 4, ROOF);
    m.cylinder(3, 3.5, 2.3, 0, 7, (x, y) => (y % 3 === 0 ? '#c3c9cf' : '#dde2e7'));
    m.cylinder(3, 3.5, 2.3, 8, 8, brand);
    for (const [x, z] of [[-1, 0], [0, 6], [6, 0], [6, 6], [-1, 6]]) {
      m.set(x, 0, z, '#3f8f3a').set(x, 1, z, '#3f8f3a').set(x, 2, z, '#ffcc00');
    }
  },

  // Маркет: широкий павільйон з вітриною і світною вивіскою
  market({ m, brand }) {
    m.box(-6, 0, 0, 6, 3, 5, WHITE, { windows: WARM, dense: true });
    m.box(-6, 4, 0, 6, 4, 5, brand);
    m.box(-3, 5, 3, 3, 6, 3, brand, { glow: true });
    m.box(-6, 0, 6, -4, 1, 6, '#9e9e9e'); // візки
  },

  // Пошта: офіс + поштомат із світними комірками
  post({ m, brand }) {
    m.box(-6, 0, 0, 1, 4, 5, WHITE, { windows: GLASS });
    m.box(-6, 5, 0, 1, 5, 5, brand);
    m.box(-4, 6, 2, -1, 7, 3, brand, { glow: true });
    m.box(3, 0, 1, 6, 4, 4, brand);
    for (let x = 3; x <= 6; x++) for (let y = 1; y <= 3; y++) if ((x + y) % 2 === 0) m.set(x, y, 5, '#d8fff4', true);
    m.box(3, 0, 6, 4, 0, 6, '#c69c6d'); // посилки
    m.set(3, 1, 6, '#c69c6d');
  },

  // Телеком: офіс і вишка зі світним маяком
  telecom({ m, brand }) {
    m.box(-6, 0, 1, -2, 4, 5, WHITE, { windows: GLASS });
    m.box(-6, 5, 1, -2, 5, 5, brand);
    for (let y = 0; y <= 15; y++) {
      const c = Math.floor(y / 2) % 2 ? brand : '#ffffff';
      m.set(2, y, 3, c).set(3, y, 3, c);
      if (y % 5 === 4) m.set(1, y, 3, '#cfcfcf').set(4, y, 3, '#cfcfcf');
    }
    m.box(4, 11, 2, 4, 12, 4, '#e0e0e0');
    m.set(2, 16, 3, '#ff2a2a', true).set(3, 16, 3, '#ff2a2a', true);
  },

  // E-commerce: склад, коробки
  warehouse({ m, brand }) {
    m.box(-6, 0, 0, 6, 3, 5, '#d9d4c7', { windows: WARM });
    m.box(-6, 4, 0, 6, 4, 5, brand);
    m.box(-2, 5, 2, 2, 5, 3, brand, { glow: true });
    for (const [x, h] of [[-5, 1], [-3, 0], [3, 1], [5, 0]]) for (let y = 0; y <= h; y++) m.set(x, y, 6, '#c69c6d');
  },

  // Банк: класичні колони і фронтон
  bank({ m, brand }) {
    m.box(-6, 0, 0, 6, 0, 6, '#cfcfcf', { hollow: false });
    m.box(-5, 1, 0, 5, 4, 3, '#f4efe6', { windows: WARM });
    for (const x of [-5, -3, -1, 1, 3, 5]) m.box(x, 1, 5, x, 4, 5, '#ffffff');
    m.box(-6, 5, 0, 6, 5, 6, brand);
    m.box(-4, 6, 1, 4, 6, 5, brand);
    m.box(-2, 7, 2, 2, 7, 4, brand);
    m.set(0, 8, 3, '#ffd700', true);
  },

  // IT: скляна вежа з суцільним склінням + прибудова
  it({ m, brand }) {
    m.box(-5, 0, 0, 0, 13, 5, '#4f6d80', { windows: '#8fe3ff', dense: true });
    m.box(-5, 14, 0, 0, 14, 5, brand);
    for (let y = 15; y <= 17; y++) m.set(-2, y, 3, '#cfd8dc');
    m.set(-2, 18, 3, '#ff3b3b', true);
    m.box(2, 0, 1, 6, 4, 5, brand, { windows: '#ffffff' });
    m.box(2, 5, 1, 6, 5, 5, '#2e3b44');
  },

  // Укренерго: опора ЛЕП + трансформатор
  pylon({ m, brand }) {
    const steel = '#9aa3ad';
    for (let y = 0; y <= 13; y++) {
      const w = y < 5 ? 2 : 1;
      for (const sx of [-w, w]) for (const sz of [-w, w]) m.set(sx, y, 3 + sz, steel);
    }
    m.box(-6, 9, 3, 6, 9, 3, steel);
    m.box(-5, 12, 3, 5, 12, 3, steel);
    for (const x of [-6, 6, -5, 5]) m.set(x, x === 6 || x === -6 ? 8 : 11, 3, '#8fd8ff', true);
    m.set(0, 14, 3, brand, true);
    m.box(4, 0, 0, 6, 2, 1, '#7a8a99');
    m.set(5, 3, 0, '#ffcd00', true);
  },

  // ДТЕК: вітряк (анімовані лопаті) і сонячні панелі
  wind({ m, brand, part }) {
    for (let y = 0; y <= 12; y++) m.set(2, y, 3, '#f5f5f5');
    m.box(1, 13, 2, 3, 14, 4, '#ffffff');
    m.set(2, 14, 1, brand, true);
    for (let x = -6; x <= -1; x++) for (let z = 0; z <= 6; z++) m.set(x, 0, z, (x + z) % 2 ? '#1d3a6e' : '#2a4f8f');
    const blades = new VoxelModel(U);
    blades.set(0, 0, 0, brand);
    for (let a = 0; a < 3; a++) {
      const ang = (a * Math.PI * 2) / 3;
      for (let r = 1; r <= 7; r++) blades.set(Math.round(Math.cos(ang) * r), Math.round(Math.sin(ang) * r), 0, '#ffffff');
    }
    part('blades', blades, [2.5, 13.5, 5.2]);
  },

  // Укрзалізниця: локомотив і вагон на коліях
  rail({ m, brand }) {
    for (let x = -6; x <= 6; x++) {
      m.set(x, 0, 2, '#6b6b6b').set(x, 0, 5, '#6b6b6b');
      if (x % 2 === 0) m.set(x, 0, 3, '#7a5a3a').set(x, 0, 4, '#7a5a3a');
    }
    m.box(-6, 1, 2, 0, 4, 5, brand, { windows: WARM });
    m.box(-6, 2, 2, 0, 2, 5, '#ffd500');
    m.box(-5, 5, 3, -2, 5, 4, '#37474f');
    m.set(-7, 2, 3, '#fff6c0', true).set(-7, 2, 4, '#fff6c0', true);
    m.box(2, 1, 2, 6, 3, 5, '#cfd6df', { windows: WARM });
  },

  // Укррічфлот: кораблик на воді
  boat({ m, brand }) {
    for (let x = -6; x <= 6; x++) for (let z = 0; z <= 6; z++) m.set(x, 0, z, (x * 7 + z * 3) % 5 === 0 ? '#5fb0f0' : '#2f86d6');
    m.box(-5, 1, 1, 4, 2, 5, brand);
    m.box(5, 2, 2, 5, 2, 4, brand);
    m.box(-3, 3, 2, 1, 5, 4, WHITE, { windows: GLASS });
    m.box(-2, 6, 3, -1, 7, 3, '#e53935');
    m.set(3, 3, 1, '#ff7043').set(3, 3, 5, '#ff7043');
  },

  // Uklon: таксі на дорозі
  taxi({ m, brand }) {
    for (let x = -6; x <= 6; x++) for (let z = 0; z <= 6; z++) m.set(x, 0, z, z === 3 && x % 3 === 0 ? '#f2f2f2' : '#3b3b3b');
    for (const [x, z] of [[-3, 1], [2, 1], [-3, 5], [2, 5]]) m.set(x, 1, z, '#111111');
    m.box(-4, 1, 2, 3, 2, 4, brand);
    m.box(-2, 3, 2, 1, 3, 4, '#a8d8ff');
    m.set(-1, 4, 3, '#ffe066', true).set(0, 4, 3, '#ffe066', true);
    m.set(4, 2, 2, '#fff8d0', true).set(4, 2, 4, '#fff8d0', true);
    m.set(-5, 2, 2, '#ff3030', true).set(-5, 2, 4, '#ff3030', true);
  },

  // Бориспіль: літак на смузі (тимчасово не літає)
  plane({ m, brand }) {
    for (let x = -6; x <= 6; x++) for (let z = 0; z <= 6; z++) m.set(x, 0, z, z === 3 && x % 2 === 0 ? '#f2f2f2' : '#4a4a4a');
    m.box(-5, 1, 2, 4, 2, 4, '#f5f5f5');
    m.box(5, 1, 3, 5, 1, 3, '#f5f5f5');
    m.box(-1, 2, 0, 1, 2, 6, '#e0e0e0');
    m.box(-5, 3, 3, -4, 5, 3, brand);
    m.box(-5, 2, 1, -4, 2, 5, '#e0e0e0');
    m.set(5, 2, 3, '#9fdcff', true);
    for (let x = -3; x <= 3; x += 2) m.set(x, 2, 4, '#ffe9a8', true);
  },

  // Нафтогаз: резервуар, труби і факел
  gas({ m, brand }) {
    m.cylinder(-3, 3.5, 2.6, 0, 5, '#e8e8e8');
    m.cylinder(-3, 3.5, 2.6, 4, 4, brand);
    m.box(0, 1, 3, 6, 1, 3, '#9e9e9e');
    for (let y = 0; y <= 7; y++) m.set(5, y, 5, '#777777');
    m.set(5, 8, 5, '#ff8a00', true).set(5, 9, 5, '#ffd000', true);
  },

  // Водоканал: водонапірна вежа
  water({ m, brand }) {
    for (const [x, z] of [[-4, 1], [1, 1], [-4, 6], [1, 6]]) for (let y = 0; y <= 6; y++) m.set(x, y, z, '#6d6d6d');
    m.cylinder(-1.5, 4, 3, 7, 10, brand);
    m.cylinder(-1.5, 4, 2, 11, 11, '#ffffff');
    m.set(-2, 12, 3, '#7fd4ff', true);
    m.box(3, 0, 2, 6, 0, 5, '#4fc3f7', { hollow: false });
  },

  // Податок ФОП: маленька податкова і стоси паперів
  tax({ m }) {
    m.box(-6, 0, 1, -1, 3, 5, '#d6d0c4', { windows: WARM });
    m.box(-6, 4, 1, -1, 4, 5, '#7b5e57');
    m.box(1, 0, 2, 2, 4, 3, '#ffffff');
    m.box(4, 0, 2, 5, 1, 3, '#ffcf33');
    m.set(4, 2, 2, '#ffcf33');
  },

  // Картки — гліфи, що левітують
  card({ m, part, deckColor, icon }) {
    m.box(-2, 0, 2, 2, 0, 5, '#3a3a44');
    m.box(-1, 1, 3, 1, 1, 4, deckColor, { glow: true });
    const g = new VoxelModel(U * 0.9);
    const glyphs = {
      '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
      '!': ['.##.', '.##.', '.##.', '.##.', '.##.', '....', '.##.'],
      '♥': ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
    };
    g.glyph(glyphs[icon] ?? glyphs['?'], deckColor);
    part('glyph', g, [0, 4, 3.5]);
  },
};

// ───────────── Кутові клітинки (тримаємо в зовнішній половині: z ≥ 0) ─────────────
export const CORNERS = {
  start({ m }) {
    const arrow = ['....#...', '...##...', '..######', '...##...', '....#...'];
    arrow.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && m.set(3 - c, 0, 1 + r, '#39d353', true)));
    for (let y = 0; y <= 9; y++) m.set(5, y, 5, '#8d6e63');
    m.box(-1, 8, 5, 4, 9, 5, '#0057b7');
    m.box(-1, 6, 5, 4, 7, 5, '#ffd500');
  },

  tck({ m }) {
    m.box(1, 0, 2, 6, 4, 6, '#556b4a', { windows: WARM });
    m.box(1, 5, 2, 6, 5, 6, '#33402c');
    m.box(2, 6, 4, 5, 6, 4, '#ff3b3b', { glow: true });
    for (let y = 0; y <= 2; y++) m.set(-1, y, 2, '#333333');
    for (let x = -7; x <= -2; x++) m.set(x, 2, 2, x % 2 ? '#ffffff' : '#e53935');
  },

  shelter({ m }) {
    m.box(-7, 0, 1, 7, 2, 7, (x, y) => (y === 2 ? '#6f8f4a' : '#5d6b4a'));
    m.box(-3, 0, 0, 3, 4, 3, CONCRETE);
    m.box(-1, 0, 0, 1, 2, 0, '#1a1a1a');
    m.box(-2, 3, -1, 2, 3, -1, '#39ff88', { glow: true });
    for (const x of [-3, 3]) m.set(x, 0, -1, '#c2a878').set(x, 1, -1, '#c2a878');
    m.set(5, 3, 4, '#2e7d32').set(5, 4, 4, '#43a047').set(-5, 3, 5, '#43a047');
  },

  bus({ m }) {
    for (let x = -7; x <= 7; x++) for (let z = 0; z <= 7; z++) m.set(x, 0, z, z === 4 && x % 3 === 0 ? '#f2f2f2' : '#3b3b3b');
    for (const [x, z] of [[-4, 1], [3, 1], [-4, 6], [3, 6]]) m.set(x, 1, z, '#111111');
    m.box(-6, 1, 2, 5, 5, 5, '#f1f1f1', { windows: '#59636e', dense: true });
    m.box(-6, 6, 2, 5, 6, 5, '#e6e6e6');
    m.set(6, 2, 2, '#fff8d0', true).set(6, 2, 5, '#fff8d0', true);
    m.set(-1, 7, 3, '#ff8c00', true);
  },
};
