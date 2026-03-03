import { get, set } from "idb-keyval";
import { parseKeywordFlags } from "../engine/rules";
import type { CardDefinition, CardsCacheEntry, RawCardDataset, RawCardEntry, RawCardPrinting } from "./types";

export const CARD_DATA_URL =
  "https://raw.githubusercontent.com/Latepate64/duel-masters-json/master/DuelMastersCards.json";

const CARD_CACHE_KEY = "duelmasters:cards:v1";

const SUSPECT_MOJIBAKE = /Ã|Â|â€”|â€“|â€|â€™|â€œ|â€�/;

const UNICODE_TO_CP1252: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function countMojibakeHints(value: string): number {
  const matches = value.match(new RegExp(SUSPECT_MOJIBAKE.source, "g"));
  return matches ? matches.length : 0;
}

function encodeWindows1252(value: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const mapped = UNICODE_TO_CP1252[codePoint];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    return null;
  }
  return new Uint8Array(bytes);
}

export function bestEffortFixString(input: string): string {
  const normalized = normalizeNewlines(input);
  if (!SUSPECT_MOJIBAKE.test(normalized)) {
    return normalized;
  }
  const cp1252Bytes = encodeWindows1252(normalized);
  if (!cp1252Bytes) {
    return normalized;
  }
  const repaired = normalizeNewlines(new TextDecoder("utf-8", { fatal: false }).decode(cp1252Bytes));
  if (countMojibakeHints(repaired) <= countMojibakeHints(normalized)) {
    return repaired;
  }
  return normalized;
}

function normalizePrinting(printing: RawCardPrinting): RawCardPrinting {
  return {
    set: bestEffortFixString(printing.set),
    id: bestEffortFixString(printing.id),
    rarity: bestEffortFixString(printing.rarity),
    illustrator: bestEffortFixString(printing.illustrator),
    flavor: printing.flavor ? bestEffortFixString(printing.flavor) : undefined
  };
}

function parsePower(powerRaw: string | undefined): { powerRaw: string | null; powerBase: number | null; powerHasPlus: boolean } {
  if (!powerRaw) {
    return { powerRaw: null, powerBase: null, powerHasPlus: false };
  }
  const fixed = bestEffortFixString(powerRaw);
  const numberMatch = fixed.match(/\d+/);
  const powerBase = numberMatch ? Number.parseInt(numberMatch[0], 10) : null;
  return {
    powerRaw: fixed,
    powerBase: Number.isFinite(powerBase) ? powerBase : null,
    powerHasPlus: fixed.includes("+")
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makeStableId(primary: RawCardPrinting | null, normalizedName: string): string {
  const set = primary?.set ?? "unknown-set";
  const id = primary?.id ?? "unknown-id";
  return `${slug(set)}:${slug(id)}:${slug(normalizedName)}`;
}

export function normalizeCard(raw: RawCardEntry): CardDefinition {
  const printings = raw.printings?.map(normalizePrinting) ?? [];
  const primaryPrinting = printings[0] ?? null;
  const name = bestEffortFixString(raw.name);
  const text = bestEffortFixString(raw.text ?? "");
  const power = parsePower(raw.power);
  const civilizations = (raw.civilizations ?? []).map((civilization) => bestEffortFixString(civilization));
  const subtypes = (raw.subtypes ?? []).map((subtype) => bestEffortFixString(subtype));
  const supertypes = (raw.supertypes ?? []).map((supertype) => bestEffortFixString(supertype));
  const type = bestEffortFixString(raw.type ?? "");

  return {
    id: makeStableId(primaryPrinting, name),
    name,
    type,
    cost: Number.isFinite(raw.cost) ? raw.cost : 0,
    civilizations,
    text,
    powerRaw: power.powerRaw,
    powerBase: power.powerBase,
    powerHasPlus: power.powerHasPlus,
    subtypes,
    supertypes,
    printings,
    primaryPrinting,
    keywords: parseKeywordFlags(text)
  };
}

export function buildCardIndex(cards: CardDefinition[]): Record<string, CardDefinition> {
  return cards.reduce<Record<string, CardDefinition>>((index, card) => {
    index[card.id] = card;
    return index;
  }, {});
}

async function downloadCards(onProgress?: (message: string) => void): Promise<CardDefinition[]> {
  onProgress?.("Downloading card database...");
  const response = await fetch(CARD_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch card database: ${response.status}`);
  }
  onProgress?.("Parsing card database...");
  const raw = (await response.json()) as RawCardDataset;
  const cards: CardDefinition[] = [];
  onProgress?.(`Normalizing ${raw.cards.length} cards...`);
  for (let i = 0; i < raw.cards.length; i += 1) {
    cards.push(normalizeCard(raw.cards[i]));
    if (i > 0 && i % 4000 === 0) {
      onProgress?.(`Normalizing cards... ${i}/${raw.cards.length}`);
    }
  }
  onProgress?.(`Ready: ${cards.length} cards loaded.`);
  return cards;
}

async function writeCache(cards: CardDefinition[]): Promise<void> {
  const entry: CardsCacheEntry = {
    cards,
    fetchedAt: Date.now()
  };
  await set(CARD_CACHE_KEY, entry);
}

export interface LoadCardsOptions {
  forceRefresh?: boolean;
  onProgress?: (message: string) => void;
  onBackgroundUpdate?: (cards: CardDefinition[]) => void;
}

export async function refreshCardCache(options: LoadCardsOptions = {}): Promise<CardDefinition[]> {
  const cards = await downloadCards(options.onProgress);
  await writeCache(cards);
  options.onBackgroundUpdate?.(cards);
  return cards;
}

export async function loadCardsWithCache(options: LoadCardsOptions = {}): Promise<CardDefinition[]> {
  if (!options.forceRefresh) {
    options.onProgress?.("Checking IndexedDB cache...");
    const cached = await get<CardsCacheEntry>(CARD_CACHE_KEY);
    if (cached && cached.cards.length > 0) {
      options.onProgress?.(`Loaded ${cached.cards.length} cards from cache. Revalidating in background...`);
      void refreshCardCache({
        onProgress: options.onProgress,
        onBackgroundUpdate: options.onBackgroundUpdate
      }).catch((error) => {
        // Keep cache usable even if background refresh fails.
        console.warn("Background card refresh failed:", error);
      });
      return cached.cards;
    }
  }
  return refreshCardCache(options);
}
