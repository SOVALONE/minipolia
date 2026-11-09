// Точка входу: збирає рушій, світ, HUD і гру. GameView — «міст» між логікою Game та 3D/HUD.
import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { PostFX } from './core/PostFX.js';
import { DayNight } from './core/DayNight.js';
import { Board } from './world/Board.js';
import { Token } from './world/Token.js';
import { Dice } from './world/Dice.js';
import { Particles } from './world/Particles.js';
import { PlanarShadow } from './world/PlanarShadow.js';
import { HUD } from './ui/HUD.js';
import { Sfx } from './audio/Sfx.js';
import { Game } from './game/Game.js';
import { TILES, GROUPS, SHELTER_TILE } from './game/data/tiles.js';
import { CONFIG, fmt } from './config.js';
import { updateTweens, wait } from './utils/tween.js';

class GameView {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.tokens = [];
    this.follow = true;
    this.focus = new THREE.Vector3();
    this.activeId = -1;
    this.planar = [];
    // «Низькі»: статика має запечені тіні, а рухомі об'єкти — проєктовану тінь щокадру
    if (!this.engine.realtimeShadows) {
      for (const d of this.dice.dice) this.planar.push(new PlanarShadow(this.engine.scene, d, 0.104));
    }
  }

  /** Перезапекти статичні тіні після зміни дошки (прапорець, філія) — один прохід, не щокадру. */
  rebake(delay = 0) {
    if (this.engine.realtimeShadows) return;
    wait(delay).then(() => this.engine.bakeShadows());
  }

  attach(game) {
    this.game = game;
    for (const p of game.state.players) {
      const t = new Token(this.engine, p);
      t.place(this.board.slotPos(0, p.id));
      t.root.rotation.y = -Math.PI / 2;
      this.tokens[p.id] = t;
      if (!this.engine.realtimeShadows) this.planar.push(new PlanarShadow(this.engine.scene, t.root, CONFIG.tileTop + 0.004));
    }
  }

  tick(dt, time) {
    for (const t of this.tokens) t.update(dt, time, t.player.id === this.activeId);
    if (this.planar.length) {
      PlanarShadow.setStrength(0.38 * (1 - this.day.night * 0.6));
      for (const s of this.planar) s.update(this.day.lightDir);
    }
    if (this.follow && this.game) {
      // Плавно зсуваємо і ціль, і камеру — орбіта користувача зберігається
      const c = this.engine.controls;
      const step = this.focus.clone().sub(c.target).multiplyScalar(1 - Math.exp(-dt * 2.2));
      c.target.add(step);
      this.engine.camera.position.add(step);
    }
  }

  focusOn(pos) { this.focus.set(pos.x * 0.55, 0, pos.z * 0.55); }

  // ───────────── інтерфейс view для Game ─────────────
  update(state) { this.hud.update(state); }
  log(msg) { this.hud.log(msg); }
  toast(msg, kind) { this.hud.toast(msg, kind); }
  choose(opts) { return this.hud.choose(opts); }

  focusPlayer(p) {
    this.activeId = p.id;
    this.focusOn(this.tokens[p.id].root.position);
  }

  async rollDice(a, b) {
    this.sfx.dice();
    await this.dice.roll(a, b);
  }

  async movePlayer(p, path) {
    const tk = this.tokens[p.id];
    const duration = path.length > 12 ? 0.14 : 0.24;
    for (const i of path) {
      const pos = this.board.slotPos(i, p.id);
      await tk.hopTo(pos, { duration, height: 0.7 });
      this.sfx.hop();
      this.particles.puff(pos, 2, '#e8e0d0');
      this.focusOn(pos);
    }
  }

  async teleportPlayer(p, i) {
    const tk = this.tokens[p.id];
    this.particles.puff(tk.root.position, 8);
    const pos = this.board.slotPos(i, p.id);
    this.focusOn(pos);
    await tk.flyTo(pos, 1.1);
    this.particles.puff(pos, 8);
  }

  async sendToShelter(players) {
    this.focusOn(this.board.tilePos(SHELTER_TILE));
    await Promise.all(players.map((p, k) =>
      wait(k * 0.18).then(() => this.tokens[p.id].flyTo(this.board.slotPos(SHELTER_TILE, p.id), 1.2))));
    this.particles.puff(this.board.tilePos(SHELTER_TILE).add(new THREE.Vector3(0, 0.3, 0)), 14, '#bdbdbd');
  }

  async returnFromShelter(p) {
    const pos = this.board.slotPos(p.position, p.id);
    this.focusOn(pos);
    await this.tokens[p.id].flyTo(pos, 1.0);
  }

  async showCard(deck, card, p) {
    this.sfx.card();
    await this.hud.showCard(deck, card, p, p.isBot);
    const pos = this.tokens[p.id].root.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    if (card.tone === 'good') this.particles.burst(pos, ['#ffd500', '#0057b7', '#ffffff'], { count: 40, power: 4 });
    else if (card.tone === 'bad') { this.sfx.bad(); this.particles.puff(pos, 10, '#6d6d6d'); }
  }

  async onPurchase(i, p) {
    this.sfx.buy();
    this.board.setOwner(i, p.color);
    const pos = this.board.local(i, 0, 0.7, 0.5);
    this.particles.burst(pos, [p.color, GROUPS[TILES[i].group].color, '#ffd500', '#0057b7', '#ffffff']);
    await this.board.popBuilding(i);
    this.rebake();
  }

  onUpgrade(i, level, p) {
    this.sfx.buy();
    this.board.setLevel(i, level);
    this.rebake(0.8);
    this.particles.burst(this.board.local(i, 0, 0.4, -1.0), [p.color, '#ffffff', '#c62828'], { count: 30, power: 4 });
  }

  onPropertyReleased(i) {
    this.board.setOwner(i, null);
    this.board.setLevel(i, 0);
    this.rebake();
    this.particles.puff(this.board.local(i, 0, 0.5, 0.5), 8, '#777777');
  }

  onBankrupt(p) {
    const tk = this.tokens[p.id];
    this.particles.puff(tk.root.position, 16, '#555555');
    tk.setVisible(false);
  }

  moneyFx(p, amount) {
    if (!amount) return;
    if (amount > 0) this.sfx.coin(); else this.sfx.pay();
    this.hud.toast(`${p.name}: ${amount > 0 ? '+' : '−'}${fmt(Math.abs(amount))}`, amount > 0 ? 'good' : 'bad');
  }

  async airRaidAlert(on) {
    this.hud.raid(on);
    if (on) { this.sfx.siren(); await wait(1.4); }
  }

  celebrateFund() {
    this.sfx.buy();
    this.hud.toast('🎉 Банку на ЗСУ закрито!', 'good');
    for (let k = 0; k < 4; k++) this.particles.burst(new THREE.Vector3((k - 1.5) * 2, 1, 0), ['#0057b7', '#ffd500'], { count: 60, power: 8 });
  }

  showWinner(p, state) {
    this.hud.showWinner(p, state);
    this.particles.burst(this.tokens[p.id].root.position.clone(), [p.color, '#ffd500', '#0057b7'], { count: 120, power: 9 });
  }
}

async function boot() {
  // Чекаємо шрифт Unbounded (для підписів на канвасі), але не довше 2.5 с
  await Promise.race([document.fonts.load('800 40px Unbounded'), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});

  const engine = new Engine(document.getElementById('app'));
  if (CONFIG.gfx.post) engine.post = new PostFX(engine);
  const day = new DayNight(engine, engine.post);
  const board = new Board(engine);
  const dice = new Dice(engine);
  const particles = new Particles(engine);
  const hud = new HUD(document.getElementById('hud'));
  const sfx = new Sfx();
  const view = new GameView({ engine, board, dice, particles, hud, sfx, day });
  engine.bakeShadows(); // «Низькі»: один прохід карти тіней для всієї статики

  let clockTimer = 0;
  engine.onFrame((dt, t) => {
    updateTweens(dt);
    day.update(dt);
    board.update(dt, t);
    particles.update(dt);
    view.tick(dt, t);
    if ((clockTimer -= dt) <= 0) { clockTimer = 0.5; hud.setClock(day.clock, day.phaseName); }
  });
  engine.controls.autoRotate = true;      // «вітрина» в стартовому меню
  engine.controls.autoRotateSpeed = 0.5;
  engine.start();

  // Клік по клітинці — інформація
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  engine.renderer.domElement.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
  engine.renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, engine.camera);
    hud.showTileInfo(board.pick(ray), view.game?.state);
  });

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'KeyF': view.follow = !view.follow; hud.toast(`Камера-слідування: ${view.follow ? 'увімк.' : 'вимк.'}`); break;
      case 'KeyT': day.speed = day.speed === 1 ? 20 : 1; hud.toast(`Швидкість доби ×${day.speed}`); break;
      case 'KeyG': if (engine.post) { engine.post.ao.enabled = !engine.post.ao.enabled; hud.toast(`SSAO: ${engine.post.ao.enabled ? 'увімк.' : 'вимк.'}`); } break;
      case 'KeyB': if (engine.post) { engine.post.bloom.enabled = !engine.post.bloom.enabled; hud.toast(`Bloom: ${engine.post.bloom.enabled ? 'увімк.' : 'вимк.'}`); } break;
      case 'KeyM': sfx.enabled = !sfx.enabled; hud.toast(`Звук: ${sfx.enabled ? 'увімк.' : 'вимк.'}`); break;
    }
  });

  const bootEl = document.getElementById('boot');
  bootEl.style.opacity = 0;
  setTimeout(() => bootEl.remove(), 700);

  const players = await hud.startMenu();
  engine.controls.autoRotate = false;
  const game = new Game(view, players);
  view.attach(game);
  hud.bind(game);
  window.minipolia = { game, engine, day }; // для дебагу в консолі
  game.emit();
  game.start();
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('boot').textContent = `Помилка запуску: ${err.message}`;
});
