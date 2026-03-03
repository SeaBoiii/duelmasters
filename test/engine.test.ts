import { describe, expect, it } from "vitest";
import type { CardDefinition, KeywordFlags } from "../src/data/types";
import { canPayManaRequirement } from "../src/engine/rules";
import { reduceGameState } from "../src/engine/reducer";
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
        hasLost: false
      }
    },
    activePlayerId: "P1",
    startingPlayerId: "P1",
    turnNumber: 2,
    phase: "BATTLE",
    chargedManaThisTurn: false,
    winnerId: null,
    log: [],
    pendingPrompt: null,
    pendingTriggers: [],
    cardIndex
  };
}

describe("rules and reducer", () => {
  it("validates mana requirements (untapped count + civilizations)", () => {
    const target = makeCard({
      id: "multi",
      name: "Dual Strike",
      cost: 3,
      civilizations: ["Fire", "Nature"],
      type: "Spell",
      powerRaw: null,
      powerBase: null
    });
    const fireMana = makeCard({ id: "fire", name: "Fire Mana", civilizations: ["Fire"] });
    const natureMana = makeCard({ id: "nature", name: "Nature Mana", civilizations: ["Nature"] });

    expect(canPayManaRequirement(target, [fireMana], 3).ok).toBe(false);
    expect(canPayManaRequirement(target, [fireMana, natureMana], 2).ok).toBe(false);
    expect(canPayManaRequirement(target, [fireMana, natureMana], 3).ok).toBe(true);
  });

  it("breaks the correct shield count for Double Breaker", () => {
    const attacker = makeCard({
      id: "attacker",
      name: "Twin Fang",
      powerBase: 3000,
      keywords: { ...baseKeywords(), doubleBreaker: true }
    });
    const shieldA = makeCard({ id: "shield-a", name: "Shield A", type: "Spell", powerRaw: null, powerBase: null });
    const shieldB = makeCard({ id: "shield-b", name: "Shield B", type: "Spell", powerRaw: null, powerBase: null });
    const shieldC = makeCard({ id: "shield-c", name: "Shield C", type: "Spell", powerRaw: null, powerBase: null });

    const state = buildState({
      attacker: attacker,
      "shield-a": shieldA,
      "shield-b": shieldB,
      "shield-c": shieldC
    });
    state.players.P1.battle.push(makeInstance("p1-attacker", "attacker", "P1"));
    state.players.P2.shields.push(
      makeInstance("s1", "shield-a", "P2"),
      makeInstance("s2", "shield-b", "P2"),
      makeInstance("s3", "shield-c", "P2")
    );

    const next = reduceGameState(state, {
      type: "DECLARE_ATTACK",
      attackerId: "p1-attacker",
      target: { kind: "player", playerId: "P2" }
    });

    expect(next.players.P2.shields).toHaveLength(1);
    expect(next.players.P2.hand).toHaveLength(2);
    expect(next.winnerId).toBeNull();
  });

  it("supports blocker redirect", () => {
    const attacker = makeCard({ id: "attacker", name: "Burn Blade", powerBase: 3000 });
    const blocker = makeCard({
      id: "blocker",
      name: "Wall Guard",
      powerBase: 1000,
      keywords: { ...baseKeywords(), blocker: true }
    });
    const state = buildState({
      attacker,
      blocker
    });
    state.players.P1.battle.push(makeInstance("p1-attacker", "attacker", "P1"));
    state.players.P2.battle.push(makeInstance("p2-blocker", "blocker", "P2"));
    state.players.P2.shields.push(makeInstance("shield", "blocker", "P2"));

    const declared = reduceGameState(state, {
      type: "DECLARE_ATTACK",
      attackerId: "p1-attacker",
      target: { kind: "player", playerId: "P2" }
    });
    expect(declared.pendingPrompt?.type).toBe("blocker");

    const afterBlock = reduceGameState(declared, {
      type: "CHOOSE_BLOCKER",
      blockerId: "p2-blocker"
    });

    expect(afterBlock.players.P2.shields).toHaveLength(1);
    expect(afterBlock.players.P2.graveyard).toHaveLength(1);
    expect(afterBlock.players.P1.battle).toHaveLength(1);
  });

  it("prompts and resolves shield trigger flow", () => {
    const attacker = makeCard({ id: "attacker", name: "Raider", powerBase: 2000 });
    const triggerSpell = makeCard({
      id: "trigger",
      name: "Mystic Veil",
      type: "Spell",
      cost: 5,
      text: "Shield Trigger: Draw one.",
      powerRaw: null,
      powerBase: null,
      keywords: { ...baseKeywords(), shieldTrigger: true }
    });
    const state = buildState({
      attacker,
      trigger: triggerSpell
    });
    state.players.P1.battle.push(makeInstance("p1-attacker", "attacker", "P1"));
    state.players.P2.shields.push(makeInstance("shield-trigger", "trigger", "P2"));

    const attacked = reduceGameState(state, {
      type: "DECLARE_ATTACK",
      attackerId: "p1-attacker",
      target: { kind: "player", playerId: "P2" }
    });

    expect(attacked.pendingPrompt?.type).toBe("shieldTrigger");
    expect(attacked.players.P2.hand.some((card) => card.instanceId === "shield-trigger")).toBe(true);

    const resolved = reduceGameState(attacked, {
      type: "RESOLVE_SHIELD_TRIGGER",
      activate: true
    });

    expect(resolved.pendingPrompt).toBeNull();
    expect(resolved.players.P2.hand.some((card) => card.instanceId === "shield-trigger")).toBe(false);
    expect(resolved.players.P2.graveyard.some((card) => card.instanceId === "shield-trigger")).toBe(true);
  });
});
