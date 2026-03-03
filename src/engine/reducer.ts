import { produce } from "immer";
import type { CardDefinition } from "../data/types";
import { canPayManaRequirement, getAttackingPower, getShieldBreakCount, isCreature, isSpell, shuffleDeterministic } from "./rules";
import { canCreatureAttack, getEligibleBlockers, getOpponentId } from "./selectors";
import type {
  AttackContext,
  CardInstance,
  GameAction,
  GameState,
  PendingManaPayment,
  PlayerId,
  PlayerState,
  TriggerOpportunity
} from "./types";

export const PHASE_ORDER: readonly string[] = ["UNTAP", "DRAW", "MANA", "MAIN", "BATTLE", "END"];

interface CreateGameOptions {
  playerNames?: Partial<Record<PlayerId, string>>;
  seed?: number;
  startingPlayerId?: PlayerId;
}

function pushLog(state: GameState, entry: string): void {
  state.log.push(entry);
  if (state.log.length > 200) {
    state.log.shift();
  }
}

function removeFromZone(zone: CardInstance[], instanceId: string): CardInstance | null {
  const index = zone.findIndex((card) => card.instanceId === instanceId);
  if (index < 0) {
    return null;
  }
  return zone.splice(index, 1)[0];
}

function findInZone(zone: CardInstance[], instanceId: string): CardInstance | null {
  return zone.find((card) => card.instanceId === instanceId) ?? null;
}

function getCard(state: GameState, instance: CardInstance | null): CardDefinition | null {
  if (!instance) {
    return null;
  }
  return state.cardIndex[instance.cardId] ?? null;
}

function createPlayerState(id: PlayerId, name: string, deckCards: CardInstance[]): PlayerState {
  return {
    id,
    name,
    deck: deckCards,
    hand: [],
    mana: [],
    battle: [],
    graveyard: [],
    shields: [],
    drawnCount: 0,
    hasLost: false
  };
}

function drawOne(state: GameState, playerId: PlayerId): CardInstance | null {
  const player = state.players[playerId];
  const next = player.deck.shift();
  if (!next) {
    const opponent = getOpponentId(playerId);
    state.winnerId = opponent;
    player.hasLost = true;
    pushLog(state, `${player.name} tried to draw from an empty deck and loses.`);
    return null;
  }
  player.hand.push(next);
  player.drawnCount += 1;
  pushLog(state, `${player.name} draws a card.`);
  if (player.deck.length === 0) {
    const opponent = getOpponentId(playerId);
    state.winnerId = opponent;
    player.hasLost = true;
    pushLog(state, `${player.name} drew the final card and loses (deck-out rule).`);
  }
  return next;
}

function moveCreatureToGraveyard(state: GameState, ownerId: PlayerId, creatureId: string, reason: string): void {
  const owner = state.players[ownerId];
  const removed = removeFromZone(owner.battle, creatureId);
  if (!removed) {
    return;
  }
  removed.tapped = false;
  removed.summoningSickness = false;
  owner.graveyard.push(removed);
  const card = getCard(state, removed);
  if (card) {
    pushLog(state, `${card.name} is destroyed (${reason}).`);
  }
}

function resolveCreatureBattle(state: GameState, attackerOwnerId: PlayerId, attackerId: string, defenderId: PlayerId, defenderCreatureId: string): void {
  const attackerPlayer = state.players[attackerOwnerId];
  const defenderPlayer = state.players[defenderId];
  const attacker = findInZone(attackerPlayer.battle, attackerId);
  const defender = findInZone(defenderPlayer.battle, defenderCreatureId);
  if (!attacker || !defender) {
    return;
  }
  const attackerDef = getCard(state, attacker);
  const defenderDef = getCard(state, defender);
  if (!attackerDef || !defenderDef) {
    return;
  }
  const attackerPower = getAttackingPower(attackerDef, true);
  const defenderPower = getAttackingPower(defenderDef, false);
  pushLog(state, `${attackerDef.name} (${attackerPower}) battles ${defenderDef.name} (${defenderPower}).`);

  let destroyAttacker = false;
  let destroyDefender = false;
  if (attackerPower > defenderPower) {
    destroyDefender = true;
  } else if (attackerPower < defenderPower) {
    destroyAttacker = true;
  } else {
    destroyAttacker = true;
    destroyDefender = true;
  }

  if (attackerDef.keywords.slayer) {
    destroyDefender = true;
  }
  if (defenderDef.keywords.slayer) {
    destroyAttacker = true;
  }

  if (destroyAttacker) {
    moveCreatureToGraveyard(state, attackerOwnerId, attackerId, "battle");
  }
  if (destroyDefender) {
    moveCreatureToGraveyard(state, defenderId, defenderCreatureId, "battle");
  }
}

function queueShieldTriggers(state: GameState, opportunities: TriggerOpportunity[]): void {
  state.pendingTriggers.push(...opportunities);
}

function startNextShieldTriggerPrompt(state: GameState): void {
  if (state.pendingPrompt || state.pendingTriggers.length === 0) {
    return;
  }
  const next = state.pendingTriggers.shift();
  if (!next) {
    return;
  }
  const player = state.players[next.playerId];
  const inHand = player.hand.some((card) => card.instanceId === next.handInstanceId);
  if (!inHand) {
    startNextShieldTriggerPrompt(state);
    return;
  }
  state.pendingPrompt = {
    type: "shieldTrigger",
    playerId: next.playerId,
    handInstanceId: next.handInstanceId
  };
}

function resolveAttack(state: GameState, attack: AttackContext): void {
  if (state.winnerId) {
    return;
  }
  const attackerPlayer = state.players[attack.attackerOwnerId];
  const attacker = findInZone(attackerPlayer.battle, attack.attackerId);
  const attackerDef = getCard(state, attacker);
  if (!attacker || !attackerDef) {
    return;
  }

  if (attack.target.kind === "creature") {
    resolveCreatureBattle(state, attack.attackerOwnerId, attack.attackerId, attack.defenderId, attack.target.creatureId);
    return;
  }

  const defender = state.players[attack.target.playerId];
  if (defender.shields.length === 0) {
    state.winnerId = attack.attackerOwnerId;
    defender.hasLost = true;
    pushLog(state, `${attackerDef.name} lands a direct attack. ${defender.name} loses.`);
    return;
  }

  const shieldsToBreak = Math.min(getShieldBreakCount(attackerDef), defender.shields.length);
  pushLog(state, `${attackerDef.name} breaks ${shieldsToBreak} shield(s).`);

  const opportunities: TriggerOpportunity[] = [];
  for (let i = 0; i < shieldsToBreak; i += 1) {
    const broken = defender.shields.shift();
    if (!broken) {
      break;
    }
    defender.hand.push(broken);
    const brokenDef = getCard(state, broken);
    if (!brokenDef) {
      continue;
    }
    pushLog(state, `${defender.name} adds broken shield ${brokenDef.name} to hand.`);
    if (brokenDef.keywords.shieldTrigger) {
      opportunities.push({
        playerId: defender.id,
        handInstanceId: broken.instanceId
      });
    }
  }

  if (opportunities.length > 0) {
    queueShieldTriggers(state, opportunities);
    startNextShieldTriggerPrompt(state);
  }
}

function resolvePlayFromHand(state: GameState, playerId: PlayerId, handInstanceId: string, isFree: boolean): boolean {
  const player = state.players[playerId];
  const fromHand = removeFromZone(player.hand, handInstanceId);
  if (!fromHand) {
    return false;
  }
  const card = getCard(state, fromHand);
  if (!card) {
    return false;
  }

  if (isCreature(card)) {
    fromHand.tapped = false;
    fromHand.summoningSickness = true;
    player.battle.push(fromHand);
    pushLog(state, `${player.name} summons ${card.name}${isFree ? " for free" : ""}.`);
    return true;
  }

  if (isSpell(card)) {
    if (card.keywords.charger) {
      fromHand.tapped = true;
      fromHand.summoningSickness = false;
      player.mana.push(fromHand);
      pushLog(state, `${player.name} casts ${card.name}${isFree ? " for free" : ""}. Charger puts it into mana tapped.`);
    } else {
      fromHand.tapped = false;
      fromHand.summoningSickness = false;
      player.graveyard.push(fromHand);
      pushLog(state, `${player.name} casts ${card.name}${isFree ? " for free" : ""}.`);
    }
    return true;
  }

  player.graveyard.push(fromHand);
  pushLog(state, `${player.name} plays ${card.name}.`);
  return true;
}

function beginTurn(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  for (const mana of player.mana) {
    mana.tapped = false;
  }
  for (const creature of player.battle) {
    creature.tapped = false;
    creature.summoningSickness = false;
  }
}

function isStartingPlayersFirstTurn(state: GameState): boolean {
  return state.turnNumber === 1 && state.activePlayerId === state.startingPlayerId;
}

function runUntapPhase(state: GameState): void {
  const active = state.players[state.activePlayerId];
  if (!isStartingPlayersFirstTurn(state)) {
    beginTurn(state, state.activePlayerId);
    pushLog(state, `${active.name} untaps.`);
  } else {
    pushLog(state, `${active.name} skips untap on the very first turn.`);
  }
  state.phase = "DRAW";
}

function runDrawPhase(state: GameState): void {
  const active = state.players[state.activePlayerId];
  if (!isStartingPlayersFirstTurn(state)) {
    drawOne(state, state.activePlayerId);
  } else {
    pushLog(state, `${active.name} skips draw on the very first turn.`);
  }
  if (!state.winnerId) {
    state.phase = "MANA";
    state.chargedManaThisTurn = false;
  }
}

function runAutoPhasesUntilDecision(state: GameState): void {
  while (!state.winnerId && (state.phase === "UNTAP" || state.phase === "DRAW")) {
    if (state.phase === "UNTAP") {
      runUntapPhase(state);
      continue;
    }
    runDrawPhase(state);
  }
}

function getPlayActionType(card: CardDefinition): PendingManaPayment["actionType"] {
  if (isCreature(card)) {
    return "summon";
  }
  if (isSpell(card)) {
    return "cast";
  }
  return "play";
}

function createPendingPayment(state: GameState, playerId: PlayerId, cardInstanceId: string): PendingManaPayment | null {
  const player = state.players[playerId];
  const cardInstance = player.hand.find((card) => card.instanceId === cardInstanceId);
  const card = getCard(state, cardInstance ?? null);
  if (!cardInstance || !card) {
    return null;
  }
  if (card.cost === 0) {
    const played = resolvePlayFromHand(state, playerId, cardInstanceId, false);
    if (!played) {
      pushLog(state, `Unable to play ${card.name}.`);
    }
    return null;
  }
  return {
    playerId,
    cardInstanceId,
    selectedManaInstanceIds: [],
    actionType: getPlayActionType(card)
  };
}

function createDeckInstances(deckCardIds: string[], ownerId: PlayerId, seed: number): CardInstance[] {
  const shuffled = shuffleDeterministic(deckCardIds, seed);
  return shuffled.map((cardId, index) => ({
    instanceId: `${ownerId}-${index + 1}`,
    cardId,
    ownerId,
    tapped: false,
    summoningSickness: false
  }));
}

function setupOpeningHands(player: PlayerState): void {
  for (let i = 0; i < 5; i += 1) {
    const shield = player.deck.shift();
    if (shield) {
      player.shields.push(shield);
    }
  }
  for (let i = 0; i < 5; i += 1) {
    const drawn = player.deck.shift();
    if (drawn) {
      player.hand.push(drawn);
      player.drawnCount += 1;
    }
  }
}

export function createInitialGameState(
  p1DeckCardIds: string[],
  p2DeckCardIds: string[],
  cardIndex: Record<string, CardDefinition>,
  options: CreateGameOptions = {}
): GameState {
  const seed = options.seed ?? 1;
  const player1 = createPlayerState(
    "P1",
    options.playerNames?.P1 ?? "Player 1",
    createDeckInstances(p1DeckCardIds, "P1", seed)
  );
  const player2 = createPlayerState(
    "P2",
    options.playerNames?.P2 ?? "Player 2",
    createDeckInstances(p2DeckCardIds, "P2", seed + 99)
  );
  setupOpeningHands(player1);
  setupOpeningHands(player2);

  const startingPlayerId = options.startingPlayerId ?? "P1";
  return {
    players: {
      P1: player1,
      P2: player2
    },
    activePlayerId: startingPlayerId,
    startingPlayerId,
    turnNumber: 1,
    phase: "UNTAP",
    chargedManaThisTurn: false,
    winnerId: null,
    log: [
      "Game start: each player set 5 shields and drew 5 cards.",
      `${startingPlayerId === "P1" ? player1.name : player2.name} goes first.`
    ],
    pendingPrompt: null,
    pendingPayment: null,
    pendingTriggers: [],
    cardIndex
  };
}

export function reduceGameState(state: GameState, action: GameAction): GameState {
  return produce(state, (draft) => {
    if (draft.winnerId && action.type !== "CONCEDE") {
      return;
    }

    switch (action.type) {
      case "ADVANCE": {
        if (draft.pendingPrompt || draft.pendingPayment) {
          return;
        }

        if (draft.phase === "UNTAP" || draft.phase === "DRAW") {
          runAutoPhasesUntilDecision(draft);
          return;
        }
        if (draft.phase === "MANA") {
          draft.phase = "MAIN";
          return;
        }
        if (draft.phase === "MAIN") {
          draft.phase = "BATTLE";
          return;
        }
        if (draft.phase === "BATTLE") {
          draft.phase = "END";
          return;
        }
        if (draft.phase === "END") {
          const endingPlayer = draft.players[draft.activePlayerId];
          draft.activePlayerId = getOpponentId(draft.activePlayerId);
          draft.turnNumber += 1;
          draft.phase = "UNTAP";
          draft.chargedManaThisTurn = false;
          pushLog(draft, `${endingPlayer.name} ends turn.`);
          runAutoPhasesUntilDecision(draft);
        }
        return;
      }
      case "CHARGE_MANA": {
        if (draft.pendingPrompt || draft.pendingPayment || draft.phase !== "MANA" || draft.chargedManaThisTurn) {
          return;
        }
        const player = draft.players[draft.activePlayerId];
        const charged = removeFromZone(player.hand, action.handInstanceId);
        if (!charged) {
          return;
        }
        charged.tapped = true;
        charged.summoningSickness = false;
        player.mana.push(charged);
        draft.chargedManaThisTurn = true;
        const card = getCard(draft, charged);
        if (card) {
          pushLog(draft, `${player.name} charges ${card.name} to mana.`);
        }
        // Mana charge is once per turn; move straight to MAIN to reduce click friction.
        draft.phase = "MAIN";
        return;
      }
      case "REQUEST_PLAY_CARD": {
        if (draft.pendingPrompt || draft.pendingPayment) {
          return;
        }
        const activeId = draft.activePlayerId;
        const player = draft.players[activeId];
        const inHand = player.hand.some((card) => card.instanceId === action.handInstanceId);
        if (!inHand) {
          return;
        }

        const isFree = action.free ?? false;
        if (!isFree && draft.phase !== "MAIN") {
          return;
        }
        if (isFree) {
          resolvePlayFromHand(draft, activeId, action.handInstanceId, true);
          return;
        }
        const pending = createPendingPayment(draft, activeId, action.handInstanceId);
        if (pending) {
          draft.pendingPayment = pending;
        }
        return;
      }
      case "TOGGLE_MANA_SELECTION": {
        if (!draft.pendingPayment) {
          return;
        }
        const player = draft.players[draft.pendingPayment.playerId];
        const mana = player.mana.find((entry) => entry.instanceId === action.manaInstanceId);
        if (!mana || mana.tapped) {
          return;
        }
        const selected = draft.pendingPayment.selectedManaInstanceIds;
        const index = selected.indexOf(action.manaInstanceId);
        if (index >= 0) {
          selected.splice(index, 1);
        } else {
          selected.push(action.manaInstanceId);
        }
        return;
      }
      case "CONFIRM_MANA_PAYMENT": {
        if (!draft.pendingPayment) {
          return;
        }
        const payment = draft.pendingPayment;
        if (draft.phase !== "MAIN") {
          pushLog(draft, "Can only cast/summon during MAIN phase.");
          return;
        }
        const player = draft.players[payment.playerId];
        const handCard = findInZone(player.hand, payment.cardInstanceId);
        const card = getCard(draft, handCard);
        if (!handCard || !card) {
          draft.pendingPayment = null;
          return;
        }
        const selectedSet = new Set(payment.selectedManaInstanceIds);
        const selectedMana = player.mana.filter((mana) => selectedSet.has(mana.instanceId));
        const selectedUntapped = selectedMana.filter((mana) => !mana.tapped);
        if (selectedUntapped.length !== selectedSet.size) {
          pushLog(draft, "Selected mana must be untapped.");
          return;
        }
        if (selectedUntapped.length < card.cost) {
          pushLog(draft, `Need at least ${card.cost} selected mana to play ${card.name}.`);
          return;
        }
        const manaCards = player.mana.map((mana) => draft.cardIndex[mana.cardId]).filter((entry): entry is CardDefinition => !!entry);
        const manaRequirement = canPayManaRequirement(card, manaCards, player.mana.filter((mana) => !mana.tapped).length);
        if (!manaRequirement.ok) {
          pushLog(draft, `Cannot play ${card.name}. ${manaRequirement.reason ?? ""}`.trim());
          return;
        }
        for (const mana of selectedUntapped) {
          mana.tapped = true;
        }
        draft.pendingPayment = null;
        resolvePlayFromHand(draft, payment.playerId, payment.cardInstanceId, false);
        return;
      }
      case "CANCEL_MANA_PAYMENT": {
        if (draft.pendingPayment) {
          draft.pendingPayment = null;
        }
        return;
      }
      case "DECLARE_ATTACK": {
        if (draft.pendingPrompt || draft.pendingPayment || draft.phase !== "BATTLE") {
          return;
        }
        const attackerOwnerId = draft.activePlayerId;
        const defenderId = getOpponentId(attackerOwnerId);
        if (action.target.kind === "player" && action.target.playerId !== defenderId) {
          return;
        }
        const attacker = findInZone(draft.players[attackerOwnerId].battle, action.attackerId);
        if (!attacker || !canCreatureAttack(draft, attacker)) {
          return;
        }

        if (action.target.kind === "creature") {
          const defenderCreature = findInZone(draft.players[defenderId].battle, action.target.creatureId);
          if (!defenderCreature || !defenderCreature.tapped) {
            return;
          }
        }

        attacker.tapped = true;
        const attackerDef = getCard(draft, attacker);
        if (attackerDef) {
          pushLog(draft, `${attackerDef.name} attacks.`);
        }
        const attack: AttackContext = {
          attackerId: action.attackerId,
          attackerOwnerId,
          defenderId,
          target: action.target
        };
        const blockers = getEligibleBlockers(draft, defenderId);
        if (blockers.length > 0) {
          draft.pendingPrompt = {
            type: "blocker",
            defenderId,
            blockers: blockers.map((blocker) => blocker.instanceId),
            attack
          };
          return;
        }
        resolveAttack(draft, attack);
        return;
      }
      case "CHOOSE_BLOCKER": {
        if (!draft.pendingPrompt || draft.pendingPrompt.type !== "blocker") {
          return;
        }
        const prompt = draft.pendingPrompt;
        const defender = draft.players[prompt.defenderId];
        let chosenTarget = prompt.attack.target;
        if (action.blockerId) {
          const blockerAllowed = prompt.blockers.includes(action.blockerId);
          const blocker = findInZone(defender.battle, action.blockerId);
          if (blockerAllowed && blocker && !blocker.tapped) {
            blocker.tapped = true;
            chosenTarget = {
              kind: "creature",
              creatureId: action.blockerId
            };
            const blockerCard = getCard(draft, blocker);
            if (blockerCard) {
              pushLog(draft, `${defender.name} blocks with ${blockerCard.name}.`);
            }
          }
        }
        draft.pendingPrompt = null;
        resolveAttack(draft, {
          ...prompt.attack,
          target: chosenTarget
        });
        return;
      }
      case "RESOLVE_SHIELD_TRIGGER": {
        if (!draft.pendingPrompt || draft.pendingPrompt.type !== "shieldTrigger") {
          return;
        }
        const prompt = draft.pendingPrompt;
        draft.pendingPrompt = null;
        const player = draft.players[prompt.playerId];
        const instance = findInZone(player.hand, prompt.handInstanceId);
        const card = getCard(draft, instance);
        if (action.activate && instance && card) {
          pushLog(draft, `${player.name} activates Shield Trigger on ${card.name}.`);
          resolvePlayFromHand(draft, prompt.playerId, prompt.handInstanceId, true);
        } else if (instance && card) {
          pushLog(draft, `${player.name} declines Shield Trigger on ${card.name}.`);
        }
        startNextShieldTriggerPrompt(draft);
        return;
      }
      case "CONCEDE": {
        const loser = draft.players[action.playerId];
        const winnerId = getOpponentId(action.playerId);
        draft.winnerId = winnerId;
        loser.hasLost = true;
        pushLog(draft, `${loser.name} concedes.`);
        return;
      }
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  });
}
