import type { CardDefinition } from "../data/types";
import { isCreature } from "./rules";
import type { CardInstance, GameState, PlayerId, PlayerState, ZoneName } from "./types";

const ZONES: ZoneName[] = ["deck", "hand", "mana", "battle", "graveyard", "shields"];

export function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

export function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  return state.players[playerId];
}

export function getCardByInstance(state: GameState, instance: CardInstance): CardDefinition | null {
  return state.cardIndex[instance.cardId] ?? null;
}

export interface FoundInstance {
  zone: ZoneName;
  card: CardInstance;
}

export function findInstanceInPlayer(player: PlayerState, instanceId: string): FoundInstance | null {
  for (const zone of ZONES) {
    const match = player[zone].find((card) => card.instanceId === instanceId);
    if (match) {
      return { zone, card: match };
    }
  }
  return null;
}

export function findInstanceInState(state: GameState, instanceId: string): FoundInstance & { playerId: PlayerId } | null {
  for (const playerId of ["P1", "P2"] as const) {
    const found = findInstanceInPlayer(state.players[playerId], instanceId);
    if (found) {
      return { ...found, playerId };
    }
  }
  return null;
}

export function getUntappedMana(player: PlayerState): CardInstance[] {
  return player.mana.filter((mana) => !mana.tapped);
}

export function getEligibleBlockers(state: GameState, defenderId: PlayerId): CardInstance[] {
  return state.players[defenderId].battle.filter((creature) => {
    if (creature.tapped) {
      return false;
    }
    const card = getCardByInstance(state, creature);
    return card ? card.keywords.blocker : false;
  });
}

export function canCreatureAttack(state: GameState, creature: CardInstance): boolean {
  if (creature.ownerId !== state.activePlayerId) {
    return false;
  }
  if (creature.tapped || creature.summoningSickness) {
    return false;
  }
  const card = getCardByInstance(state, creature);
  return card ? isCreature(card) : false;
}
