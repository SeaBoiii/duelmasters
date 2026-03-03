import type { CardDefinition, KeywordFlags } from "../data/types";

const POWER_ATTACKER_REGEX = /power attacker\s*\+(\d+)/i;

export function parseKeywordFlags(text: string): KeywordFlags {
  const normalized = text.toLowerCase();
  const powerMatch = text.match(POWER_ATTACKER_REGEX);
  const bonus = powerMatch ? Number.parseInt(powerMatch[1], 10) : 0;
  return {
    blocker: /\bblocker\b/i.test(normalized),
    charger: /\bcharger\b/i.test(normalized),
    doubleBreaker: /\bdouble breaker\b/i.test(normalized),
    powerAttackerBonus: Number.isFinite(bonus) ? bonus : 0,
    shieldTrigger: /\bshield trigger\b/i.test(normalized),
    slayer: /\bslayer\b/i.test(normalized),
    tripleBreaker: /\btriple breaker\b/i.test(normalized)
  };
}

export function isCreature(card: CardDefinition): boolean {
  return card.type.toLowerCase() === "creature";
}

export function isSpell(card: CardDefinition): boolean {
  return card.type.toLowerCase() === "spell";
}

export function getShieldBreakCount(card: CardDefinition): number {
  if (card.keywords.tripleBreaker) {
    return 3;
  }
  if (card.keywords.doubleBreaker) {
    return 2;
  }
  return 1;
}

export function getAttackingPower(card: CardDefinition, isAttacking: boolean): number {
  const base = card.powerBase ?? 0;
  if (!isAttacking) {
    return base;
  }
  return base + card.keywords.powerAttackerBonus;
}

function collectCivilizations(cards: CardDefinition[]): Set<string> {
  const found = new Set<string>();
  for (const card of cards) {
    for (const civilization of card.civilizations) {
      found.add(civilization.toLowerCase());
    }
  }
  return found;
}

export interface ManaRequirementResult {
  ok: boolean;
  reason: string | null;
}

export function canPayManaRequirement(
  card: CardDefinition,
  manaCards: CardDefinition[],
  untappedManaCount: number
): ManaRequirementResult {
  if (untappedManaCount < card.cost) {
    return {
      ok: false,
      reason: `Need ${card.cost} untapped mana; only ${untappedManaCount} available.`
    };
  }
  const civilizations = collectCivilizations(manaCards);
  const required = card.civilizations.map((civ) => civ.toLowerCase());
  const missing = required.filter((civ) => !civilizations.has(civ));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Missing civilization(s): ${missing.join(", ")}.`
    };
  }
  return { ok: true, reason: null };
}

// Deterministic PRNG for reproducible deck shuffles.
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
