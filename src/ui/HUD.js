// DOM-інтерфейс: стартове меню, панель гравців, банка ЗСУ, кнопки, журнал, картки, діалоги.
import { TILES, GROUPS, isOwnable } from '../game/data/tiles.js';
import { DECKS } from '../game/data/cards.js';
import { canUpgrade, upgradeCost, ownedTiles, baseRent, netWorth } from '../game/rules.js';
import { CONFIG, fmt, DEFAULT_PLAYERS, TOKEN_KINDS, QUALITY_PRESETS, applyQuality } from '../config.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class HUD {
  constructor(root) {
    root.innerHTML = `
      <header class="topbar panel">
        <div class="logo">МІНІ<span>ПОЛІЯ</span></div>
        <div class="clock"><span id="clock">06:30</span><small id="phase">Світанок</small><small id="round"></small></div>
        <div class="fund">
          <div class="fund-title">🫙 Банка на ЗСУ <b id="fund-val">0 ₴</b></div>
          <div class="bar"><i id="fund-bar"></i></div>
        </div>
        <button id="btn-gfx" class="btn tiny gfx-btn" title="Налаштування графіки">⚙️ ${QUALITY_PRESETS[CONFIG.gfx.id].name}</button>
      </header>
      <aside id="players" class="panel"></aside>
      <aside id="props" class="panel hidden"></aside>
      <div id="log" class="panel"></div>
      <div id="actions">
        <button id="btn-roll" class="btn primary">🎲 Кинути кубики</button>
        <button id="btn-end" class="btn">Завершити хід ➜</button>
        <div id="bot-note" class="hidden">🤖 Ходить бот…</div>
      </div>
      <div id="tile-info" class="panel hidden"></div>
      <div id="help">ЛКМ — обертати • ПКМ — зсув • колесо — зум • клік по клітинці — інфо<br>
        <b>F</b> камера-слідування • <b>T</b> час ×20 • <b>G</b> SSAO • <b>B</b> Bloom • <b>M</b> звук</div>
      <div id="toasts"></div>
      <div id="raid" class="hidden"><div>🚨 ПОВІТРЯНА ТРИВОГА 🚨<small>Усі в укриття!</small></div></div>
      <div id="modal" class="hidden"></div>`;
    this.root = root;
    this.$ = (id) => root.querySelector(id);
    this.$('#btn-gfx').onclick = () => this.graphicsMenu();
  }

  // ───────────── графіка ─────────────
  qualityButtons() {
    return Object.entries(QUALITY_PRESETS).map(([id, q]) => `
      <button class="btn quality ${id === CONFIG.gfx.id ? 'current' : ''}" data-q="${id}" ${q.ready ? '' : 'disabled'}>
        ${q.name}${q.ready ? '' : ' <small>скоро</small>'}${id === CONFIG.gfx.id ? ' <small>✓ зараз</small>' : ''}
      </button>`).join('');
  }

  /** Вибір пресету під час гри: рендерер створюється з нуля, тож сторінка перезапускається. */
  graphicsMenu() {
    if (this.modalOpen) return;
    const inGame = this.game && this.game.state.phase !== 'over';
    const m = this.openModal(`
      <div class="deck">⚙️ Графіка</div>
      <h2>Якість графіки</h2>
      <p><b>Ультра</b> — тіні в реальному часі (CSM), SSAO, Bloom, SMAA.<br>
         <b>Низькі</b> — без постобробки, тіні запечені, у фішок — тінь у реальному часі.</p>
      ${inGame ? '<p class="warn">⚠️ Зміна якості перезапустить сторінку — поточну партію буде втрачено.</p>' : ''}
      <div class="buttons quality-list">${this.qualityButtons()}<button class="btn" data-close>Скасувати</button></div>`, '#7fd4ff');
    m.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => {
      if (b.dataset.q === CONFIG.gfx.id) return this.closeModal();
      applyQuality(b.dataset.q);
    }));
    m.querySelector('[data-close]').onclick = () => this.closeModal();
  }

  bind(game) {
    this.game = game;
    this.$('#btn-roll').onclick = () => game.actionRoll();
    this.$('#btn-end').onclick = () => game.actionEnd();
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.modalOpen) { e.preventDefault(); game.state.phase === 'roll' ? game.actionRoll() : game.actionEnd(); }
    });
  }

  // ───────────── стан ─────────────
  update(state) {
    const cur = state.players[state.current];
    this.$('#players').innerHTML = state.players.map((p) => {
      const n = ownedTiles(state, p.id).length;
      const badges = [
        p.inShelter && '<span class="badge blue">🛡️ укриття</span>',
        p.inTCK && `<span class="badge red">🚐 ТЦК · ${p.skipTurns}</span>`,
        !p.inTCK && !p.inShelter && p.skipTurns > 0 && `<span class="badge">⏳ ${p.skipTurns}</span>`,
        p.isBot && '<span class="badge dim">бот</span>',
      ].filter(Boolean).join('');
      return `<div class="player ${p.id === cur.id ? 'active' : ''} ${p.bankrupt ? 'out' : ''}" style="--c:${p.color}">
        <div class="row"><i class="dot"></i><b>${esc(p.name)}</b><small>${TOKEN_KINDS[p.token]}</small></div>
        <div class="money">${p.bankrupt ? 'банкрут' : fmt(p.money)}</div>
        <div class="meta">🏢 ${n} · капітал ${fmt(netWorth(state, p))} · 💙💛 ${fmt(p.donated)} ${badges}</div>
      </div>`;
    }).join('');

    this.$('#round').textContent = `раунд ${state.round}${CONFIG.maxRounds ? ' / ' + CONFIG.maxRounds : ''}`;
    const goal = CONFIG.fundGoal * (state.fundClosed + 1);
    const prev = CONFIG.fundGoal * state.fundClosed;
    this.$('#fund-val').textContent = `${fmt(state.fund)} / ${fmt(goal)}`;
    this.$('#fund-bar').style.width = `${Math.min(100, ((state.fund - prev) / (goal - prev)) * 100)}%`;

    const humanTurn = !cur.isBot && state.phase !== 'over';
    this.$('#btn-roll').disabled = !(humanTurn && state.phase === 'roll');
    this.$('#btn-end').disabled = !(humanTurn && state.phase === 'end');
    this.$('#bot-note').classList.toggle('hidden', !cur.isBot || state.phase === 'over');
    this.renderProps(state, cur);
  }

  renderProps(state, p) {
    const box = this.$('#props');
    const mine = ownedTiles(state, p.id);
    if (p.isBot || !mine.length) return box.classList.add('hidden');
    box.classList.remove('hidden');
    const canAct = ['roll', 'end'].includes(state.phase);
    box.innerHTML = `<h4>Компанії: ${esc(p.name)}</h4>` + mine.sort((a, b) => a - b).map((i) => {
      const t = TILES[i], own = state.owners[i];
      const up = canAct && canUpgrade(state, p, i);
      return `<div class="prop" style="--g:${GROUPS[t.group].color}">
        <i></i><span>${esc(t.name)}</span><small>${'🏠'.repeat(own.level)}</small>
        ${t.type === 'property' ? `<button class="btn tiny" data-up="${i}" ${up ? '' : 'disabled'} title="Відкрити філію">+ ${fmt(upgradeCost(t))}</button>` : ''}
      </div>`;
    }).join('') + '<p class="hint">Філії доступні, коли маєш усю групу кольору.</p>';
    box.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => this.game.actionUpgrade(Number(b.dataset.up))));
  }

  setClock(text, phase) {
    this.$('#clock').textContent = text;
    this.$('#phase').textContent = phase;
  }

  log(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    const log = this.$('#log');
    log.prepend(el);
    while (log.children.length > 40) log.lastChild.remove();
  }

  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.$('#toasts').append(el);
    setTimeout(() => el.remove(), 2600);
  }

  raid(on) { this.$('#raid').classList.toggle('hidden', !on); }

  // ───────────── модальні вікна ─────────────
  openModal(html, color) {
    const m = this.$('#modal');
    m.innerHTML = `<div class="card" style="--c:${color}">${html}</div>`;
    m.classList.remove('hidden');
    this.modalOpen = true;
    return m;
  }

  closeModal() {
    this.$('#modal').classList.add('hidden');
    this.modalOpen = false;
  }

  /** Картка події. auto=true — закривається сама (для ботів). */
  showCard(deckId, card, player, auto) {
    const deck = DECKS[deckId];
    const m = this.openModal(`
      <div class="deck">${deck.icon} ${deck.name}</div>
      <h2>${esc(card.title)}</h2>
      <p>${esc(card.text)}</p>
      <div class="who" style="color:${player.color}">${esc(player.name)}</div>
      <div class="buttons">${auto ? '' : '<button class="btn primary" data-ok>Зрозуміло</button>'}</div>`, deck.color);
    m.querySelector('.card').classList.add(`tone-${card.tone}`);
    return new Promise((res) => {
      const done = () => { this.closeModal(); res(); };
      if (auto) setTimeout(done, 2200);
      else m.querySelector('[data-ok]').onclick = done;
    });
  }

  /** Діалог вибору → id обраної опції. */
  choose({ title, text, options, color = '#ffd500' }) {
    const m = this.openModal(`
      <h2>${esc(title)}</h2><p>${text}</p>
      <div class="buttons">${options.map((o) =>
        `<button class="btn ${o.primary ? 'primary' : ''}" data-id="${o.id}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}
      </div>`, color);
    return new Promise((res) => {
      m.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => { this.closeModal(); res(b.dataset.id); }));
    });
  }

  showTileInfo(i, state) {
    const box = this.$('#tile-info');
    if (i < 0) return box.classList.add('hidden');
    const t = TILES[i];
    const own = state?.owners[i];
    const owner = own ? state.players[own.ownerId] : null;
    let body = t.desc ? `<p>${esc(t.desc)}</p>` : '';
    if (DECKS[t.type]) body = `<p>Тягни картку колоди «${DECKS[t.type].name}».</p>`;
    if (isOwnable(t)) {
      body = `<p>${GROUPS[t.group].name}</p><p>Ціна: <b>${fmt(t.price)}</b></p>` +
        (t.type === 'property' ? `<p>Оренда: ${fmt(baseRent(t))} (×2 за монополію, до ×16 з філіями)</p>`
          : t.type === 'transport' ? '<p>Оренда: 250 ₴ × 2^(кількість−1)</p>' : '<p>Оренда: сума кубиків × 40 (або ×100 за обидві)</p>') +
        `<p>Власник: ${owner ? `<b style="color:${owner.color}">${esc(owner.name)}</b> · філій: ${own.level}` : 'вільна'}</p>`;
    }
    if (t.type === 'tax') body = `<p>Сплати ${fmt(t.amount)}.</p>`;
    box.innerHTML = `<h4 style="border-color:${t.group ? GROUPS[t.group].color : '#ffd500'}">${esc(t.name)}</h4>${body}`;
    box.classList.remove('hidden');
    clearTimeout(this.infoTimer);
    this.infoTimer = setTimeout(() => box.classList.add('hidden'), 6000);
  }

  // ───────────── старт і фінал ─────────────
  startMenu() {
    const rows = DEFAULT_PLAYERS.map((p, i) => `
      <div class="setup-row" style="--c:${p.color}">
        <input type="checkbox" data-en="${i}" ${p.enabled ? 'checked' : ''} ${i < 2 ? 'disabled' : ''}>
        <i class="dot"></i>
        <input type="text" data-name="${i}" value="${esc(p.name)}" maxlength="14">
        <select data-bot="${i}"><option value="0" ${p.isBot ? '' : 'selected'}>Людина</option><option value="1" ${p.isBot ? 'selected' : ''}>Бот</option></select>
        <small>${TOKEN_KINDS[p.token]}</small>
      </div>`).join('');
    const m = this.openModal(`
      <div class="deck">🇺🇦 воксельна бізнес-гра</div>
      <h1 class="title">МІНІ<span>ПОЛІЯ</span></h1>
      <p>Скуповуй українські компанії, відкривай філії, донать на ЗСУ та тікай від бусу ТЦК.</p>
      <div class="setup">${rows}</div>
      <div class="setup-row gfx-row"><span>⚙️ Графіка</span>
        <select data-quality>${Object.entries(QUALITY_PRESETS).map(([id, q]) =>
          `<option value="${id}" ${id === CONFIG.gfx.id ? 'selected' : ''} ${q.ready ? '' : 'disabled'}>${q.name}${q.ready ? '' : ' (скоро)'}</option>`).join('')}
        </select><small>застосується перезапуском</small></div>
      <div class="buttons"><button class="btn primary big" data-start>Почати гру</button></div>`, '#ffd500');
    m.querySelector('[data-quality]').onchange = (e) => applyQuality(e.target.value);
    m.querySelector('.card').classList.add('wide');
    return new Promise((res) => {
      m.querySelector('[data-start]').onclick = () => {
        const players = DEFAULT_PLAYERS.map((p, i) => ({
          ...p,
          enabled: i < 2 || m.querySelector(`[data-en="${i}"]`).checked,
          name: m.querySelector(`[data-name="${i}"]`).value.trim() || p.name,
          isBot: m.querySelector(`[data-bot="${i}"]`).value === '1',
        })).filter((p) => p.enabled);
        this.closeModal();
        res(players);
      };
    });
  }

  showWinner(p, state) {
    const top = [...state.players].sort((a, b) => b.donated - a.donated)[0];
    this.openModal(`
      <div class="deck">🏆 Кінець гри</div>
      <h1 class="title" style="color:${p.color}">${esc(p.name)}</h1>
      <p>Збудував(ла) найбільшу бізнес-імперію Мініполії! Капітал: <b>${fmt(netWorth(state, p))}</b></p>
      <p>Найщедріший донатер: <b style="color:${top.color}">${esc(top.name)}</b> — ${fmt(top.donated)}<br>
         Разом у банку на ЗСУ: <b>${fmt(state.fund)}</b></p>
      <div class="buttons"><button class="btn primary big" onclick="location.reload()">Ще раз</button></div>`, p.color);
  }
}
