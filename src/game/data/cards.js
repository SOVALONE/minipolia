// Колоди карток. Кожна картка — це ДАНІ: заголовок, текст і опис ефекту (effect).
// Логіка застосування ефектів — у CardSystem.js. Щоб додати нову картку, достатньо
// дописати об'єкт сюди; новий тип ефекту — додати case у CardSystem.apply().
//
// Типи ефектів:
//   money {amount}            — отримати / сплатити банку
//   fund {amount}             — обов'язковий донат у банку на ЗСУ
//   allDonate {amount}        — кожен гравець донатить у банку
//   collectFromAll {amount}   — кожен гравець платить тобі
//   percent {percent}         — сплатити % від готівки
//   repairs {perProperty, perBranch}
//   moveTo {tile}             — йти на клітинку (через «Старт» — з бонусом)
//   moveBy {steps}            — крокнути вперед/назад
//   skip {turns}              — пропустити ходи
//   airRaid                   — усі гравці йдуть в укриття й пропускають хід
//   busification              — вибір: 2 ходи в бусі ТЦК або викуп донатом

export const DECKS = {
  chance:   { name: 'Шанс',      color: '#ff9f1c', icon: '?' },
  surprise: { name: 'Сюрприз',   color: '#2ec4b6', icon: '♥' },
  penalty:  { name: 'Покарання', color: '#e71d36', icon: '!' },
};

const BUSIFICATION = {
  id: 'busification',
  title: 'Бусифікація на Донбас',
  text: 'Біля під\'їзду загальмував білий бус. Хлопці в піксельній формі щиро цікавляться твоїм військовим квитком.',
  tone: 'bad',
  effect: { type: 'busification' },
};

const AIR_RAID = {
  id: 'air-raid',
  title: 'Повітряна тривога',
  text: 'Сирена! Усі гравці кидають справи і біжать в укриття. Кожен пропускає наступний хід.',
  tone: 'bad',
  effect: { type: 'airRaid' },
};

export const CARDS = {
  chance: [
    { id: 'pitch', title: 'Успішний пітч на заході', tone: 'good',
      text: 'Ти презентував стартап інвесторам у Лісабоні. Вони не зрозуміли, що таке «борщ-as-a-service», але гроші дали.',
      effect: { type: 'money', amount: 4000 } },
    { id: 'intercity', title: 'Квиток на Інтерсіті', tone: 'neutral',
      text: 'Встиг купити квиток через 3 секунди після старту продажу. Рухайся до «Укрзалізниці».',
      effect: { type: 'moveTo', tile: 5 } },
    { id: 'parcel', title: 'Посилка чекає у відділенні', tone: 'neutral',
      text: 'Прийшла СМС: «Безкоштовне зберігання закінчується завтра». Біжи до «Нової Пошти».',
      effect: { type: 'moveTo', tile: 13 } },
    { id: 'to-start', title: 'Перезапуск бізнесу', tone: 'good',
      text: 'Півотнувся втретє за рік. Повертайся на «Старт» і отримай зарплату.',
      effect: { type: 'moveTo', tile: 0 } },
    { id: 'traffic', title: 'Затор на мосту', tone: 'bad',
      text: 'Перекрили міст «на 5 хвилин». Відступи на 3 клітинки назад.',
      effect: { type: 'moveBy', steps: -3 } },
    { id: 'silicon', title: 'Інвестор із Кремнієвої долини', tone: 'good',
      text: 'Він сказав «Slava Ukraini» майже без акценту і підписав term sheet.',
      effect: { type: 'money', amount: 3000 } },
    { id: 'deadline', title: 'Дедлайн до 11:00', tone: 'good',
      text: 'Ти здав MVP о 10:59. Замовник у захваті й виплатив бонус.',
      effect: { type: 'money', amount: 1500 } },
    BUSIFICATION,
    AIR_RAID,
  ],
  surprise: [
    { id: 'grant', title: 'Грант від держави', tone: 'good',
      text: '«єРобота» схвалила твою заявку. Без жодної черги! (Майже.)',
      effect: { type: 'money', amount: 2500 } },
    { id: 'komarov', title: 'Дмитро Комаров привіз донат', tone: 'good',
      text: 'Повернувся з чергової експедиції «Світ навиворіт», привіз магнітик і донат на розвиток твого бізнесу.',
      effect: { type: 'money', amount: 2000 } },
    { id: 'cashback', title: 'Кешбек від банку', tone: 'good',
      text: 'Кіт із застосунку схвально муркнув. Тобі нарахували кешбек.',
      effect: { type: 'money', amount: 500 } },
    { id: 'birthday', title: 'День народження', tone: 'good',
      text: 'Усі скидаються тобі по 300 ₴. Торт — із «Сільпо», свічки — від генератора.',
      effect: { type: 'collectFromAll', amount: 300 } },
    { id: 'stepan', title: 'Кіт Степан став амбасадором', tone: 'good',
      text: 'Твій бренд лайкнув найвідоміший кіт країни. Продажі злетіли.',
      effect: { type: 'money', amount: 1200 } },
    { id: 'jar', title: 'Донат на банку', tone: 'neutral',
      text: 'Друг скинув посилання на банку. Не задонатити неможливо — обов\'язковий внесок 1 000 ₴.',
      effect: { type: 'fund', amount: 1000 } },
    { id: 'volunteers', title: 'Волонтерський збір', tone: 'neutral',
      text: 'Збираємо на дрони! Кожен гравець донатить 500 ₴ у спільну банку.',
      effect: { type: 'allDonate', amount: 500 } },
    { id: 'light', title: 'Світло дали!', tone: 'good',
      text: 'Графік відключень змінився на твою користь. Встиг закрити всі задачі.',
      effect: { type: 'money', amount: 800 } },
    AIR_RAID,
  ],
  penalty: [
    BUSIFICATION,
    AIR_RAID,
    { id: 'blackout', title: 'Блекаут', tone: 'bad',
      text: 'Купуєш генератор і 20 літрів пального. Сусіди дякують за шум.',
      effect: { type: 'money', amount: -800 } },
    { id: 'tax-audit', title: 'Податкова перевірка', tone: 'bad',
      text: 'Знайшли чек на каву, оформлений як «консалтинг». Сплати 10% готівки.',
      effect: { type: 'percent', percent: 10 } },
    { id: 'repairs', title: 'Ремонт після прильоту', tone: 'bad',
      text: 'Вибило вікна в офісах. Сплати 300 ₴ за кожну компанію і 500 ₴ за кожну філію.',
      effect: { type: 'repairs', perProperty: 300, perBranch: 500 } },
    { id: 'jar-big', title: 'Донат на банку', tone: 'neutral',
      text: 'Банка на FPV-дрони майже закрита! Обов\'язковий внесок 1 500 ₴.',
      effect: { type: 'fund', amount: 1500 } },
    { id: 'border', title: 'Черга на кордоні', tone: 'bad',
      text: 'Стоїш у черзі на Ягодині вже третю добу. Пропусти 1 хід.',
      effect: { type: 'skip', turns: 1 } },
    { id: 'parking', title: 'Паркування на тротуарі', tone: 'bad',
      text: 'Залишив авто «на хвилинку». Інспектор був не згоден. Штраф 500 ₴.',
      effect: { type: 'money', amount: -500 } },
  ],
};
