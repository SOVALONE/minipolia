// Чисті функції правил (без Three.js і DOM) — легко тестувати окремо.
import { TILES, isOwnable } from './data/tiles.js';

export const MAX_LEVEL = 3;
const RENT_MULT = [1, 4, 10, 20]; // множник оренди від кількості філій

export const roundTo = (n, step = 50) => Math.round(n / step) * step;
export const baseRent = (tile) => roundTo(tile.price * 0.15, 10);
export const upgradeCost = (tile) => roundTo(tile.price * 0.5);
export const sellValue = (tile, level) => roundTo(tile.price * 0.5 + level * upgradeCost(tile) * 0.5);

export function ownedTiles(state, playerId) {
  return Object.entries(state.owners)
    .filter(([, o]) => o.ownerId === playerId)
    .map(([i]) => Number(i));
}

export function ownsWholeGroup(state, playerId, group) {
  return TILES.every((t, i) => t.group !== group || !isOwnable(t) || state.owners[i]?.ownerId === playerId);
}

export function rentFor(state, tileIndex, diceSum) {
  const tile = TILES[tileIndex];
  const own = state.owners[tileIndex];
  if (!own) return 0;
  const count = (type) => ownedTiles(state, own.ownerId).filter((i) => TILES[i].type === type).length;

  if (tile.type === 'transport') return 250 * Math.pow(2, count('transport') - 1);
  if (tile.type === 'utility') return diceSum * (count('utility') === 2 ? 100 : 40);

  const base = baseRent(tile);
  if (own.level === 0) return ownsWholeGroup(state, own.ownerId, tile.group) ? base * 2 : base;
  return base * RENT_MULT[own.level];
}

export function canUpgrade(state, player, tileIndex) {
  const tile = TILES[tileIndex];
  const own = state.owners[tileIndex];
  return (
    tile.type === 'property' &&
    own?.ownerId === player.id &&
    own.level < MAX_LEVEL &&
    ownsWholeGroup(state, player.id, tile.group) &&
    player.money >= upgradeCost(tile)
  );
}

/** Капітал гравця: готівка + вартість компаній і філій. */
export function netWorth(state, player) {
  if (player.bankrupt) return 0;
  return player.money + ownedTiles(state, player.id).reduce((s, i) => s + TILES[i].price + state.owners[i].level * upgradeCost(TILES[i]), 0);
}

export const rollDie = () => 1 + Math.floor(Math.random() * 6);
