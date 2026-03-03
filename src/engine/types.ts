import type { CardDefinition } from "../data/types";

export type PlayerId = "P1" | "P2";
export type Phase = "UNTAP" | "DRAW" | "MANA" | "MAIN" | "BATTLE" | "END";
export type ZoneName = "deck" | "hand" | "mana" | "battle" | "graveyard" | "shields";

export interface CardInstance {
  instanceId: string;
  cardId: string;
  ownerId: PlayerId;
  tapped: boolean;
  summoningSickness: boolean;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  deck: CardInstance[];
  hand: CardInstance[];
  mana: CardInstance[];
  battle: CardInstance[];
  graveyard: CardInstance[];
  shields: CardInstance[];
  hasLost: boolean;
}

export interface AttackTargetPlayer {
  kind: "player";
  playerId: PlayerId;
}

export interface AttackTargetCreature {
  kind: "creature";
  creatureId: string;
}

export type AttackTarget = AttackTargetPlayer | AttackTargetCreature;

export interface AttackContext {
  attackerId: string;
  attackerOwnerId: PlayerId;
  defenderId: PlayerId;
  target: AttackTarget;
}

export interface ManaPaymentPrompt {
  type: "manaPayment";
  playerId: PlayerId;
  handInstanceId: string;
  selectedManaIds: string[];
  free: boolean;
}

export interface BlockerPrompt {
  type: "blocker";
  defenderId: PlayerId;
  blockers: string[];
  attack: AttackContext;
}

export interface ShieldTriggerPrompt {
  type: "shieldTrigger";
  playerId: PlayerId;
  handInstanceId: string;
}

export type PendingPrompt = ManaPaymentPrompt | BlockerPrompt | ShieldTriggerPrompt;

export interface TriggerOpportunity {
  playerId: PlayerId;
  handInstanceId: string;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  activePlayerId: PlayerId;
  startingPlayerId: PlayerId;
  turnNumber: number;
  phase: Phase;
  chargedManaThisTurn: boolean;
  winnerId: PlayerId | null;
  log: string[];
  pendingPrompt: PendingPrompt | null;
  pendingTriggers: TriggerOpportunity[];
  cardIndex: Record<string, CardDefinition>;
}

export type GameAction =
  | { type: "NEXT_PHASE" }
  | { type: "CHARGE_MANA"; handInstanceId: string }
  | { type: "REQUEST_PLAY_CARD"; handInstanceId: string; free?: boolean }
  | { type: "TOGGLE_MANA_SELECTION"; manaInstanceId: string }
  | { type: "CONFIRM_MANA_PAYMENT" }
  | { type: "CANCEL_MANA_PAYMENT" }
  | { type: "DECLARE_ATTACK"; attackerId: string; target: AttackTarget }
  | { type: "CHOOSE_BLOCKER"; blockerId: string | null }
  | { type: "RESOLVE_SHIELD_TRIGGER"; activate: boolean }
  | { type: "CONCEDE"; playerId: PlayerId };
