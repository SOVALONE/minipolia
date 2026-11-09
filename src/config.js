// Глобальні налаштування гри.
// Графіка — пресети якості (вибір у меню, зберігається в localStorage, застосовується перезапуском).
// URL-перевизначення: ?quality=low|ultra, а для ультра ще ?ssao=0, ?bloom=0, ?csm=0.
const params = new URLSearchParams(location.search);

/**
 * Пресети графіки.
 *   post      — постобробка (EffectComposer)
 *   csm       — каскадні тіні в реальному часі; інакше одне сонце
 *   shadows   — 'realtime' | 'baked' (статика запікається один раз, фішки — проєктована тінь щокадру)
 *   bakedAO   — запечене затінення вокселів у колір (замінює SSAO без постобробки)
 *   sunMoves  — чи рухається напрям сонця (для запечених тіней — фіксований)
 */
export const QUALITY_PRESETS = {
  potato: { name: 'Бомж ПК', ready: false },
  low: {
    name: 'Низькі', ready: true,
    post: false, ssao: false, bloom: false, csm: false,
    shadows: 'baked', shadowMapSize: 2048, bakedAO: true, sunMoves: false,
    antialias: true, pixelRatio: 1,
  },
  medium: { name: 'Середні', ready: false },
  high: { name: 'Високі', ready: false },
  ultra: {
    name: 'Ультра', ready: true,
    post: true, ssao: true, bloom: true, csm: true,
    shadows: 'realtime', shadowMapSize: 2048, bakedAO: false, sunMoves: true,
    antialias: false, pixelRatio: 1.5,
  },
};

export const QUALITY_KEY = 'minipolia.quality';

function resolveQuality() {
  const wanted = params.get('quality') || localStorage.getItem(QUALITY_KEY) || 'ultra';
  const id = QUALITY_PRESETS[wanted]?.ready ? wanted : 'ultra';
  const gfx = { id, ...QUALITY_PRESETS[id] };
  if (params.get('ssao') === '0') gfx.ssao = false;
  if (params.get('bloom') === '0') gfx.bloom = false;
  if (params.get('csm') === '0') gfx.csm = false;
  return gfx;
}

/** Зберегти пресет і перезапустити сторінку (рендерер створюється з нуля). */
export function applyQuality(id) {
  localStorage.setItem(QUALITY_KEY, id);
  const url = new URL(location.href);
  url.searchParams.delete('quality');
  location.href = url.toString();
}

export const CONFIG = {
  // Розміри дошки
  tileSize: 2.4,       // розмір клітинки у світових одиницях
  tileTop: 0.28,       // висота верхньої площини клітинки
  voxel: 0.16,         // розмір вокселя будівель

  // Економіка (у гривнях)
  startMoney: 15000,
  passStartBonus: 2000,
  busRansom: 3000,     // «викупити бус» — донат на ЗСУ
  busSkipTurns: 2,
  fundGoal: 50000,     // ціль спільної банки на ЗСУ
  maxRounds: 30,       // швидка гра: після N раундів перемагає найбільший капітал (0 = без ліміту)

  // Доба
  dayLength: 240,      // секунд на повний цикл доби
  startTimeOfDay: 0.36, // 0 = північ, 0.25 = світанок, 0.5 = полудень

  gfx: resolveQuality(),
};

export const TOKEN_KINDS = {
  cat: 'Кіт',
  tractor: 'Трактор',
  drone: 'Дрон',
  dog: 'Пес-сапер',
};

export const DEFAULT_PLAYERS = [
  { name: 'Оксана', color: '#ffd500', token: 'cat', isBot: false, enabled: true },
  { name: 'Тарас', color: '#2f8bff', token: 'tractor', isBot: true, enabled: true },
  { name: 'Мирослава', color: '#ff4d6d', token: 'drone', isBot: true, enabled: true },
  { name: 'Богдан', color: '#2ed573', token: 'dog', isBot: true, enabled: false },
];

export const fmt = (n) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
