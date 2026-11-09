// Ігровий контролер: черга ходів, рух, купівля, оренда, банкрутство, спецподії.
// Не знає про Three.js — спілкується зі світом через об'єкт `view` (див. GameView у main.js):
//   rollDice, movePlayer, teleportPlayer, sendToShelter, returnFromShelter, showCard,
//   choose, onPurchase, onUpgrade, onPropertyReleased, onBankrupt, moneyFx, airRaidAlert,
//   celebrateFund, focusPlayer, showWinner, update, log, toast
import { TILES, TILE_COUNT, TCK_TILE, isOwnable } from './data/tiles.js';
import { CardSystem } from './CardSystem.js';
import { rentFor, canUpgrade, upgradeCost, ownedTiles, sellValue, rollDie, baseRent, netWorth } from './rules.js';
import { CONFIG, fmt } from '../config.js';
import { wait } from '../utils/tween.js';

export class Game {
  constructor(view, playerConfigs) {
    this.view = view;
    this.state = {
      players: playerConfigs.map((c, i) => ({
        id: i, name: c.name, color: c.color, token: c.token, isBot: c.isBot,
        money: CONFIG.startMoney, position: 0, skipTurns: 0,
        inTCK: false, inShelter: false, bankrupt: false, donated: 0,
      })),
      owners: {},          // tileIndex -> { ownerId, level }
      fund: 0,             // спільна банка на ЗСУ
      fundClosed: 0,
      current: 0,
      phase: 'idle',       // idle | roll | busy | end | over
      doubles: 0,
      lastRoll: [1, 1],
      turnNo: 1,
      round: 1,
    };
    this.cards = new CardSystem(this);
  }

  // ───────────── службове ─────────────
  get player() { return this.state.players[this.state.current]; }
  activePlayers() { return this.state.players.filter((p) => !p.bankrupt); }
  emit() { this.view.update(this.state); }
  log(msg) { this.view.log(msg); }
  setPhase(phase) { this.state.phase = phase; this.emit(); }

  async start() {
    this.log('🇺🇦 Гра почалась! Купуй українські компанії, донать на ЗСУ і не потрап у бус.');
    await this.beginTurn();
  }

  // ───────────── черга ходів ─────────────
  async beginTurn() {
    const p = this.player;
    this.state.doubles = 0;
    this.view.focusPlayer(p);

    if (p.skipTurns > 0) {
      p.skipTurns--;
      if (p.inShelter) {
        p.inShelter = false;
        this.log(`🛡️ ${p.name} пересидів тривогу в укритті. Відбій!`);
        await this.view.returnFromShelter(p);
      } else if (p.inTCK) {
        if (p.skipTurns === 0) {
          p.inTCK = false;
          this.log(`🚐 ${p.name} нарешті відпустили з ТЦК. Наступного ходу — вільний!`);
        } else this.log(`🚐 ${p.name} досі в бусі ТЦК (ще ${p.skipTurns} хід).`);
      } else {
        this.log(`⏳ ${p.name} пропускає хід.`);
      }
      this.emit();
      await wait(1.0);
      return this.nextTurn();
    }

    this.log(`▶️ Хід: <b style="color:${p.color}">${p.name}</b>`);
    this.setPhase('roll');
    if (p.isBot) { await wait(0.8); await this.actionRoll(); }
  }

  async nextTurn() {
    if (this.state.phase === 'over') return;
    const n = this.state.players.length;
    let i = this.state.current;
    do { i = (i + 1) % n; } while (this.state.players[i].bankrupt);
    if (i <= this.state.current) {
      this.state.round++;
      if (CONFIG.maxRounds && this.state.round > CONFIG.maxRounds) {
        this.log(`⏱️ Минуло ${CONFIG.maxRounds} раундів — рахуємо капітал!`);
        const best = [...this.activePlayers()].sort((a, b) => netWorth(this.state, b) - netWorth(this.state, a))[0];
        return this.finish(best);
      }
      this.log(`— Раунд ${this.state.round} —`);
    }
    this.state.current = i;
    this.state.turnNo++;
    await this.beginTurn();
  }

  // ───────────── дії гравця (викликаються з HUD) ─────────────
  async actionRoll() {
    if (this.state.phase !== 'roll') return;
    this.setPhase('busy');
    const p = this.player;
    const a = rollDie(), b = rollDie();
    this.state.lastRoll = [a, b];
    await this.view.rollDice(a, b);
    this.log(`🎲 ${p.name}: ${a} + ${b} = <b>${a + b}</b>${a === b ? ' (дубль!)' : ''}`);

    const isDouble = a === b;
    if (isDouble && ++this.state.doubles >= 3) {
      this.log('Три дублі поспіль — підозріло щасливий. Бус уже під\'їхав.');
      await this.sendToTCK(p, CONFIG.busSkipTurns);
      return this.afterAction(false);
    }
    await this.moveSteps(p, a + b);
    await this.resolveTile(p, a + b);
    await this.afterAction(isDouble);
  }

  async afterAction(canRollAgain) {
    const p = this.player;
    if (this.checkWinner()) return;
    if (p.bankrupt) return this.nextTurn();
    if (canRollAgain && p.skipTurns === 0) {
      this.log('Дубль — кидай ще раз!');
      this.setPhase('roll');
      if (p.isBot) { await wait(0.7); await this.actionRoll(); }
      return;
    }
    this.setPhase('end');
    if (p.isBot) {
      await this.botManage(p);
      await wait(0.7);
      await this.actionEnd();
    }
  }

  async actionEnd() {
    if (this.state.phase !== 'end') return;
    this.state.phase = 'busy';
    await this.nextTurn();
  }

  async actionUpgrade(tileIndex) {
    const p = this.player;
    if (!['roll', 'end'].includes(this.state.phase) || !canUpgrade(this.state, p, tileIndex)) return;
    const tile = TILES[tileIndex];
    const cost = upgradeCost(tile);
    await this.pay(p, cost, 'bank');
    const own = this.state.owners[tileIndex];
    own.level++;
    this.log(`🏗️ ${p.name} відкрив філію «${tile.name}» (рівень ${own.level}) за ${fmt(cost)}.`);
    this.view.onUpgrade(tileIndex, own.level, p);
    this.emit();
  }

  // ───────────── рух ─────────────
  async moveSteps(p, steps) {
    if (!steps) return;
    const dir = Math.sign(steps);
    const path = [];
    let pos = p.position, passedStart = false;
    for (let k = 0; k < Math.abs(steps); k++) {
      pos = (pos + dir + TILE_COUNT) % TILE_COUNT;
      path.push(pos);
      if (dir > 0 && pos === 0) passedStart = true;
    }
    await this.view.movePlayer(p, path);
    p.position = pos;
    if (passedStart) {
      this.log(`💰 ${p.name} проходить «Старт»: +${fmt(CONFIG.passStartBonus)}`);
      this.changeMoney(p, CONFIG.passStartBonus);
    }
    this.emit();
  }

  async sendToTCK(p, turns) {
    p.position = TCK_TILE;
    p.inTCK = true;
    p.skipTurns += turns;
    await this.view.teleportPlayer(p, TCK_TILE);
    this.log(`🚐 ${p.name} їде в бусі до ТЦК і пропускає ${turns} ходи.`);
    this.emit();
  }

  // ───────────── клітинки ─────────────
  async resolveTile(p, diceSum, depth = 0) {
    const tile = TILES[p.position];
    switch (tile.type) {
      case 'property':
      case 'transport':
      case 'utility':
        return this.handleOwnable(p, p.position, diceSum);

      case 'chance':
      case 'surprise':
      case 'penalty': {
        const card = this.cards.draw(tile.type);
        this.log(`🃏 ${p.name} тягне «${tile.name}»: <b>${card.title}</b>`);
        await this.view.showCard(tile.type, card, p);
        return this.cards.apply(card, p, depth);
      }

      case 'tax':
        this.log(`🧾 ${p.name} сплачує «${tile.name}»: ${fmt(tile.amount)}`);
        return this.pay(p, tile.amount, 'bank');

      case 'bus':
        return this.busification(p, { ransom: CONFIG.busRansom, turns: CONFIG.busSkipTurns });

      case 'shelter':
        this.log(`🫖 ${p.name} в укритті: волонтери пригостили чаєм і дали 300 ₴ на каву.`);
        return this.changeMoney(p, 300);

      case 'tck':
        return this.log(`👀 ${p.name} обережно проходить повз ТЦК…`);
    }
  }

  async handleOwnable(p, i, diceSum) {
    const tile = TILES[i];
    const own = this.state.owners[i];

    if (!own) {
      if (p.money < tile.price) return this.log(`${p.name}: не вистачає коштів на «${tile.name}».`);
      const buy = p.isBot
        ? p.money - tile.price >= 1500
        : (await this.view.choose({
            title: tile.name,
            text: `Компанія вільна! Ціна: <b>${fmt(tile.price)}</b>. Базова оренда: ${tile.type === 'property' ? fmt(baseRent(tile)) : 'залежить від кількості'}.`,
            color: tile.brand,
            tileIndex: i,
            options: [
              { id: 'buy', label: `Купити за ${fmt(tile.price)}`, primary: true },
              { id: 'skip', label: 'Відмовитись' },
            ],
          })) === 'buy';
      if (buy) await this.buy(p, i);
      else this.log(`${p.name} відмовляється від «${tile.name}».`);
      return;
    }

    if (own.ownerId === p.id) return this.log(`${p.name} відвідує власну компанію «${tile.name}».`);
    const owner = this.state.players[own.ownerId];
    const rent = rentFor(this.state, i, diceSum);
    this.log(`💸 ${p.name} платить ${owner.name} оренду за «${tile.name}»: ${fmt(rent)}`);
    await this.pay(p, rent, owner);
  }

  async buy(p, i) {
    const tile = TILES[i];
    p.money -= tile.price;
    this.state.owners[i] = { ownerId: p.id, level: 0 };
    this.log(`🏢 ${p.name} купує «${tile.name}» за ${fmt(tile.price)}!`);
    this.view.moneyFx(p, -tile.price);
    await this.view.onPurchase(i, p);
    this.emit();
  }

  // ───────────── гроші ─────────────
  changeMoney(p, amount) {
    p.money += amount;
    this.view.moneyFx(p, amount);
    this.emit();
  }

  /** to: гравець | 'bank' | 'fund' */
  async pay(p, amount, to) {
    if (amount <= 0 || p.bankrupt) return;
    await this.ensureFunds(p, amount);
    if (p.bankrupt) {
      if (typeof to === 'object') to.money += p.money; // кредитор забирає залишок
      p.money = 0;
      return this.checkWinner();
    }
    p.money -= amount;
    this.view.moneyFx(p, -amount);
    if (typeof to === 'object') to.money += amount;
    else if (to === 'fund') this.addFund(p, amount);
    this.emit();
  }

  /** Якщо грошей не вистачає — продаємо компанії, починаючи з найдешевших. */
  async ensureFunds(p, amount) {
    if (p.money >= amount) return;
    const mine = ownedTiles(this.state, p.id).sort((a, b) => TILES[a].price - TILES[b].price);
    for (const i of mine) {
      if (p.money >= amount) break;
      const own = this.state.owners[i];
      const value = sellValue(TILES[i], own.level);
      p.money += value;
      delete this.state.owners[i];
      this.log(`🔻 ${p.name} терміново продає «${TILES[i].name}» за ${fmt(value)}.`);
      this.view.onPropertyReleased(i);
    }
    if (p.money < amount) {
      p.bankrupt = true;
      this.log(`☠️ <b>${p.name}</b> — банкрут. Бізнес закрито, ФОП ліквідовано.`);
      this.view.onBankrupt(p);
    }
    this.emit();
  }

  addFund(p, amount) {
    this.state.fund += amount;
    p.donated += amount;
    const goal = CONFIG.fundGoal * (this.state.fundClosed + 1);
    if (this.state.fund >= goal) {
      this.state.fundClosed++;
      this.log(`🎉 Банку на ЗСУ закрито! Зібрано ${fmt(goal)}. Дякуємо всім донатерам!`);
      this.view.celebrateFund();
    }
  }

  // ───────────── спецподії ─────────────
  /** «Бусифікація на Донбас»: або 2 ходи в бусі ТЦК, або викуп донатом на ЗСУ. */
  async busification(p, { ransom, turns }) {
    const canPay = p.money >= ransom;
    let choice;
    if (p.isBot) {
      choice = canPay && p.money - ransom > 4000 ? 'pay' : 'ride';
    } else {
      choice = await this.view.choose({
        title: '🚐 Бусифікація на Донбас',
        text: `Бус уже відчинив двері. Що робиш?<br><small>Донат іде у спільну банку на ЗСУ.</small>`,
        color: '#e71d36',
        options: [
          { id: 'pay', label: `Задонатити ${fmt(ransom)} і «викупити бус»`, primary: true, disabled: !canPay },
          { id: 'ride', label: `Сісти в бус (пропустити ${turns} ходи)` },
        ],
      });
    }
    if (choice === 'pay') {
      this.log(`💙💛 ${p.name} «викуповує бус» донатом ${fmt(ransom)} на ЗСУ.`);
      await this.pay(p, ransom, 'fund');
      this.view.toast(`${p.name} задонатив ${fmt(ransom)} на ЗСУ`, 'good');
    } else {
      await this.sendToTCK(p, turns);
    }
  }

  /** «Повітряна тривога»: усі (крім тих, хто в ТЦК) біжать в укриття і пропускають хід. */
  async airRaid() {
    this.log('🚨 <b>Повітряна тривога!</b> Усі гравці прямують до укриття.');
    const hiding = this.activePlayers().filter((p) => !p.inTCK);
    for (const p of hiding) { p.inShelter = true; p.skipTurns += 1; }
    this.emit();
    await this.view.airRaidAlert(true);
    await this.view.sendToShelter(hiding);
    await this.view.airRaidAlert(false);
  }

  // ───────────── боти та фінал ─────────────
  async botManage(p) {
    for (const i of ownedTiles(this.state, p.id)) {
      while (canUpgrade(this.state, p, i) && p.money - upgradeCost(TILES[i]) > 3000) {
        await this.actionUpgrade(i);
        await wait(0.4);
      }
    }
  }

  checkWinner() {
    const alive = this.activePlayers();
    if (alive.length > 1 || this.state.phase === 'over') return this.state.phase === 'over';
    this.finish(alive[0]);
    return true;
  }

  finish(winner) {
    this.state.phase = 'over';
    this.log(`🏆 Переміг <b>${winner.name}</b>! Капітал: ${fmt(netWorth(this.state, winner))}`);
    this.view.showWinner(winner, this.state);
    this.emit();
  }
}

export { isOwnable };
