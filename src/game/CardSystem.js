// Обробник карток подій: тягне картку з колоди й застосовує її ефект.
import { CARDS } from './data/cards.js';
import { TILES } from './data/tiles.js';
import { ownedTiles, roundTo } from './rules.js';
import { CONFIG, fmt } from '../config.js';

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export class CardSystem {
  constructor(game) {
    this.game = game;
    this.piles = {};
    for (const deck of Object.keys(CARDS)) this.piles[deck] = shuffle([...CARDS[deck]]);
  }

  draw(deck) {
    if (!this.piles[deck].length) this.piles[deck] = shuffle([...CARDS[deck]]);
    return this.piles[deck].pop();
  }

  /** Застосувати ефект картки до гравця. depth захищає від нескінченних ланцюжків переміщень. */
  async apply(card, player, depth = 0) {
    const g = this.game;
    const e = card.effect;
    const others = () => g.activePlayers().filter((p) => p.id !== player.id);

    switch (e.type) {
      case 'money':
        if (e.amount >= 0) g.changeMoney(player, e.amount, card.title);
        else await g.pay(player, -e.amount, 'bank', card.title);
        break;

      case 'fund':
        g.log(`💙💛 ${player.name} донатить ${fmt(e.amount)} у банку на ЗСУ.`);
        await g.pay(player, e.amount, 'fund', card.title);
        break;

      case 'allDonate':
        for (const p of g.activePlayers()) await g.pay(p, e.amount, 'fund', card.title);
        g.log(`💙💛 Усі гравці задонатили по ${fmt(e.amount)}.`);
        break;

      case 'collectFromAll':
        for (const p of others()) await g.pay(p, e.amount, player, card.title);
        break;

      case 'percent': {
        const amount = roundTo((player.money * e.percent) / 100, 10);
        if (amount > 0) await g.pay(player, amount, 'bank', card.title);
        break;
      }

      case 'repairs': {
        const mine = ownedTiles(g.state, player.id);
        const branches = mine.reduce((s, i) => s + g.state.owners[i].level, 0);
        const amount = mine.length * e.perProperty + branches * e.perBranch;
        g.log(`🔧 ${player.name}: ${mine.length} компаній, ${branches} філій → ${fmt(amount)}.`);
        if (amount > 0) await g.pay(player, amount, 'bank', card.title);
        break;
      }

      case 'moveTo': {
        const steps = (e.tile - player.position + TILES.length) % TILES.length;
        await g.moveSteps(player, steps);
        if (depth < 2) await g.resolveTile(player, g.state.lastRoll[0] + g.state.lastRoll[1], depth + 1);
        break;
      }

      case 'moveBy':
        await g.moveSteps(player, e.steps);
        if (depth < 2) await g.resolveTile(player, g.state.lastRoll[0] + g.state.lastRoll[1], depth + 1);
        break;

      case 'skip':
        player.skipTurns += e.turns;
        g.log(`⏳ ${player.name} пропускає ${e.turns} хід(и).`);
        g.emit();
        break;

      case 'airRaid':
        await g.airRaid(player);
        break;

      case 'busification':
        await g.busification(player, { ransom: CONFIG.busRansom, turns: CONFIG.busSkipTurns });
        break;

      default:
        console.warn('Невідомий ефект картки', e);
    }
  }
}
