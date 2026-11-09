// 40 клітинок дошки. Нумерація: 0 — «Старт» (правий нижній кут), далі проти годинникової
// стрілки, якщо дивитися згори. Бренди використані як пародійні/фанатські назви.

export const GROUPS = {
  agro:      { name: 'Агрохолдинги',   color: '#8d5a3b' },
  market:    { name: 'Маркети',        color: '#4fc3f7' },
  post:      { name: 'Пошта й логістика', color: '#ec407a' },
  telecom:   { name: 'Телеком',        color: '#ff9800' },
  ecom:      { name: 'E-commerce',     color: '#e53935' },
  bank:      { name: 'Банки',          color: '#fdd835' },
  it:        { name: 'IT-компанії',    color: '#43a047' },
  energy:    { name: 'Енергетика',     color: '#283593' },
  transport: { name: 'Транспорт',      color: '#546e7a' },
  utility:   { name: 'Комуналка',      color: '#90a4ae' },
};

const P = (name, group, price, model, brand) => ({ type: 'property', name, group, price, model, brand });
const T = (name, model, brand) => ({ type: 'transport', name, group: 'transport', price: 2000, model, brand });
const U = (name, model, brand) => ({ type: 'utility', name, group: 'utility', price: 1500, model, brand });

export const TILES = [
  /* 0 */ { type: 'start', name: 'Старт', desc: 'Проходиш — отримуєш зарплату 2 000 ₴' },
  /* 1 */ P('Кернел', 'agro', 600, 'agro', '#f2c300'),
  /* 2 */ { type: 'surprise', name: 'Сюрприз' },
  /* 3 */ P('МХП', 'agro', 600, 'agro', '#d43c2f'),
  /* 4 */ { type: 'tax', name: 'Податок ФОП', amount: 2000 },
  /* 5 */ T('Укрзалізниця', 'rail', '#2e5aa8'),
  /* 6 */ P('АТБ', 'market', 1000, 'market', '#d32f2f'),
  /* 7 */ { type: 'chance', name: 'Шанс' },
  /* 8 */ P('Сільпо', 'market', 1000, 'market', '#f57c00'),
  /* 9 */ P('Novus', 'market', 1200, 'market', '#7cb342'),
  /* 10 */ { type: 'tck', name: 'ТЦК', desc: 'Просто проходиш повз блокпост… поки що.' },
  /* 11 */ P('Укрпошта', 'post', 1400, 'post', '#ffcc00'),
  /* 12 */ U('Нафтогаз', 'gas', '#1e5aa8'),
  /* 13 */ P('Нова Пошта', 'post', 1400, 'post', '#da291c'),
  /* 14 */ P('Meest', 'post', 1600, 'post', '#2350a0'),
  /* 15 */ T('Укррічфлот', 'boat', '#ff6d00'),
  /* 16 */ P('Київстар', 'telecom', 1800, 'telecom', '#1b6fd8'),
  /* 17 */ { type: 'surprise', name: 'Сюрприз' },
  /* 18 */ P('Vodafone UA', 'telecom', 1800, 'telecom', '#e60000'),
  /* 19 */ P('lifecell', 'telecom', 2000, 'telecom', '#ffc400'),
  /* 20 */ { type: 'shelter', name: 'Укриття', desc: 'Волонтери пригощають чаєм: +300 ₴' },
  /* 21 */ P('Rozetka', 'ecom', 2200, 'warehouse', '#00a046'),
  /* 22 */ { type: 'penalty', name: 'Покарання' },
  /* 23 */ P('Prom.ua', 'ecom', 2200, 'warehouse', '#7b2cbf'),
  /* 24 */ P('OLX', 'ecom', 2400, 'warehouse', '#23c4bb'),
  /* 25 */ T('Uklon', 'taxi', '#ffd400'),
  /* 26 */ P('ПриватБанк', 'bank', 2600, 'bank', '#5eb630'),
  /* 27 */ P('monobank', 'bank', 2600, 'bank', '#222222'),
  /* 28 */ U('Водоканал', 'water', '#3aa0e0'),
  /* 29 */ P('ПУМБ', 'bank', 2800, 'bank', '#e4002b'),
  /* 30 */ { type: 'bus', name: 'Бус ТЦК', desc: 'Біля клітинки чатує бус. Їдеш у ТЦК або викуповуєшся донатом.' },
  /* 31 */ P('SoftServe', 'it', 3000, 'it', '#1f4fbf'),
  /* 32 */ P('Grammarly', 'it', 3000, 'it', '#15c39a'),
  /* 33 */ { type: 'surprise', name: 'Сюрприз' },
  /* 34 */ P('MacPaw', 'it', 3200, 'it', '#333333'),
  /* 35 */ T('Бориспіль', 'plane', '#0057b8'),
  /* 36 */ { type: 'chance', name: 'Шанс' },
  /* 37 */ P('Укренерго', 'energy', 3500, 'pylon', '#ffcd00'),
  /* 38 */ { type: 'penalty', name: 'Покарання' },
  /* 39 */ P('ДТЕК', 'energy', 4000, 'wind', '#f5a623'),
];

export const TILE_COUNT = TILES.length;
export const TCK_TILE = 10;
export const SHELTER_TILE = 20;
export const isOwnable = (t) => t.type === 'property' || t.type === 'transport' || t.type === 'utility';
