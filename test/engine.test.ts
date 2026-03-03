import { describe, expect, it } from "vitest";
import type { CardDefinition, KeywordFlags } from "../src/data/types";
import { createInitialGameState, reduceGameState } from "../src/engine/reducer";
import type { CardInstance, GameState, PlayerId } from "../src/engine/types";

function baseKeywords(): KeywordFlags {
  return {
    blocker: false,
    charger: false,
    doubleBreaker: false,
    powerAttackerBonus: 0,
    shieldTrigger: false,
    slayer: false,
    tripleBreaker: false
  };
}

function makeCard(overrides: Partial<CardDefinition> & Pick<CardDefinition, "id" | "name">): CardDefinition {
  return {
    id: overrides.id,
    name: overrides.name,
    type: overrides.type ?? "Creature",
    cost: overrides.cost ?? 1,
    civilizations: overrides.civilizations ?? ["Fire"],
    text: overrides.text ?? "",
    powerRaw: overrides.powerRaw ?? "1000",
    powerBase: overrides.powerBase ?? 1000,
    powerHasPlus: overrides.powerHasPlus ?? false,
    subtypes: overrides.subtypes ?? [],
    supertypes: overrides.supertypes ?? [],
    printings: overrides.printings ?? [],
    primaryPrinting: overrides.primaryPrinting ?? null,
    keywords: overrides.keywords ?? baseKeywords()
  };
}

function makeInstance(instanceId: string, cardId: string, ownerId: PlayerId, tapped = false, summoningSickness = false): CardInstance {
  return {
    instanceId,
    cardId,
    ownerId,
    tapped,
    summoningSickness
  };
}

function buildState(cardIndex: Record<string, CardDefinition>): GameState {
  return {
    players: {
      P1: {
        id: "P1",
        name: "Player 1",
        deck: [],
        hand: [],
        mana: [],
        battle: [],
        graveyard: [],
        shields: [],
        drawnCount: 0,
        hasLost: false
      },
      P2: {
        id: "P2",
        name: "Player 2",
        deck: [],
        hand: [],
        mana: [],
        battle: [],
        graveyard: [],
        shields: [],
        drawnCount: 0,
        hasLost: false
      }
    },
    activePlayerId: "P1",
    startingPlayerId: "P1",
    turnNumber: 2,
    phase: "UNTAP",
    chargedManaThisTurn: false,
    winnerId: null,
    log: [],
    pendingPrompt: null,
    pendingPayment: null,
    pendingTriggers: [],
    cardIndex
  };
}

describe("phase progression", () => {
  it("cycles UNTAP -> DRAW -> MANA -> MAIN -> BATTLE -> END", () => {
    const filler = makeCard({ id: "filler", name: "Filler" });
    let state = buildState({ filler });
    state.phase = "UNTAP";
    state.players.P1.deck.push(makeInstance("d1", "filler", "P1"), makeInstance("d2", "filler", "P1"));

    state = reduceGameState(state, { type: "NEXT_PHASE" });
    expect(state.phase).toBe("DRAW");

    state = reduceGameState(state, { type: "NEXT_PHASE" });
    expect(state.phase).toBe("MANA");

    state = reduceGameState(state, { type: "NEXT_PHASE" });
    expect(state.phase).toBe("MAIN");

    state = reduceGameState(state, { type: "NEXT_PHASE" });
    expect(state.phase).toBe("BATTLE");

    state = reduceGameState(state, { type: "NEXT_PHASE" });
    expect(state.phase).toBe("END");
  });

  it("End Turn only works in END phase", () => {
    const filler = makeCard({ id: "filler", name: "Filler" });
    const state = buildState({ filler });
    const before = reduceGameState(state, { type: "END_TURN" });
    expect(before.activePlayerId).toBe("P1");
    expect(before.turnNumber).toBe(2);

    const endState = { ...state, phase: "END" as const };
    const after = reduceGameState(endState, { type: "END_TURN" });
    expect(after.activePlayerId).toBe("P2");
    expect(after.phase).toBe("UNTAP");
    expect(after.turnNumber).toBe(3);
  });
});

describe("mana selection flow", () => {
  it("cannot resolve cast/summon without selecting sufficient mana", () => {
    const summonCard = makeCard({
      id: "summon",
      name: "Summon Candidate",
      type: "Creature",
      cost: 2,
      civilizations: ["Fire"],
      powerBase: 2000
    });
    const manaCard = makeCard({ id: "mana", name: "Mana Seed", civilizations: ["Fire"] });
    const state = buildState({
      summon: summonCard,
      mana: manaCard
    });
    state.phase = "MAIN";
    state.players.P1.hand.push(makeInstance("hand1", "summon", "P1"));
    state.players.P1.mana.push(makeInstance("mana1", "mana", "P1"), makeInstance("mana2", "mana", "P1"));

    const withPending = reduceGameState(state, { type: "REQUEST_PLAY_CARD", handInstanceId: "hand1" });
    expect(withPending.pendingPayment).not.toBeNull();

    const unresolved = reduceGameState(withPending, { type: "CONFIRM_MANA_PAYMENT" });
    expect(unresolved.players.P1.battle).toHaveLength(0);
    expect(unresolved.players.P1.hand).toHaveLength(1);
  });

  it("confirming payment taps exactly selected mana", () => {
    const summonCard = makeCard({
      id: "summon",
      name: "Summon Candidate",
      type: "Creature",
      cost: 2,
      civilizations: ["Fire"],
      powerBase: 2000
    });
    const fireMana = makeCard({ id: "fire", name: "Fire Mana", civilizations: ["Fire"] });
    const waterMana = makeCard({ id: "water", name: "Water Mana", civilizations: ["Water"] });
    const state = buildState({
      summon: summonCard,
      fire: fireMana,
      water: waterMana
    });
    state.phase = "MAIN";
    state.players.P1.hand.push(makeInstance("hand1", "summon", "P1"));
    state.players.P1.mana.push(makeInstance("m1", "fire", "P1"), makeInstance("m2", "water", "P1"), makeInstance("m3", "fire", "P1"));

    let next = reduceGameState(state, { type: "REQUEST_PLAY_CARD", handInstanceId: "hand1" });
    next = reduceGameState(next, { type: "TOGGLE_MANA_SELECTION", manaInstanceId: "m1" });
    next = reduceGameState(next, { type: "TOGGLE_MANA_SELECTION", manaInstanceId: "m3" });
    next = reduceGameState(next, { type: "CONFIRM_MANA_PAYMENT" });

    expect(next.players.P1.battle).toHaveLength(1);
    expect(next.players.P1.hand).toHaveLength(0);
    expect(next.players.P1.mana.find((mana) => mana.instanceId === "m1")?.tapped).toBe(true);
    expect(next.players.P1.mana.find((mana) => mana.instanceId === "m3")?.tapped).toBe(true);
    expect(next.players.P1.mana.find((mana) => mana.instanceId === "m2")?.tapped).toBe(false);
  });
});

describe("game ending rules", () => {
  it("deck-out loss happens when a draw makes deck size 0", () => {
    const filler = makeCard({ id: "filler", name: "Filler" });
    let state = buildState({ filler });
    state.phase = "DRAW";
    state.players.P1.deck.push(makeInstance("deck-last", "filler", "P1"));
    state.players.P1.drawnCount = 39;

    state = reduceGameState(state, { type: "NEXT_PHASE" });

    expect(state.winnerId).toBe("P2");
    expect(state.players.P1.hasLost).toBe(true);
    expect(state.players.P1.deck).toHaveLength(0);
  });

  it("direct attack with no shields causes immediate loss", () => {
    const attacker = makeCard({ id: "attacker", name: "Raider", type: "Creature", cost: 3, powerBase: 3000 });
    const state = buildState({ attacker });
    state.phase = "BATTLE";
    state.players.P1.battle.push(makeInstance("a1", "attacker", "P1"));
    state.players.P2.shields = [];

    const next = reduceGameState(state, {
      type: "DECLARE_ATTACK",
      attackerId: "a1",
      target: { kind: "player", playerId: "P2" }
    });

    expect(next.winnerId).toBe("P1");
    expect(next.players.P2.hasLost).toBe(true);
  });
});

describe("start game setup", () => {
  it("creates 5 shields and 5 hand for each player", () => {
    const filler = makeCard({ id: "filler", name: "Filler" });
    const state = createInitialGameState(Array(40).fill("filler"), Array(40).fill("filler"), { filler }, { seed: 3 });
    expect(state.players.P1.shields).toHaveLength(5);
    expect(state.players.P1.hand).toHaveLength(5);
    expect(state.players.P2.shields).toHaveLength(5);
    expect(state.players.P2.hand).toHaveLength(5);
  });
});
