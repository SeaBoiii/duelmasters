import { get, set } from "idb-keyval";
import type { CardDefinition, SavedDeck } from "./types";

const DECKS_KEY = "duelmasters:decks:v1";

function now(): number {
  return Date.now();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `deck-${now()}-${Math.floor(Math.random() * 100000)}`;
}

function isSavedDeck(input: unknown): input is SavedDeck {
  if (!input || typeof input !== "object") {
    return false;
  }
  const candidate = input as SavedDeck;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.cardIds) &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    typeof candidate.starter === "boolean"
  );
}

export async function loadSavedDecks(): Promise<SavedDeck[]> {
  const stored = await get<unknown>(DECKS_KEY);
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored.filter(isSavedDeck);
}

async function writeDecks(decks: SavedDeck[]): Promise<void> {
  const ordered = [...decks].sort((a, b) => b.updatedAt - a.updatedAt);
  await set(DECKS_KEY, ordered);
}

export interface DeckInput {
  id?: string;
  name: string;
  cardIds: string[];
  starter?: boolean;
}

export async function upsertDeck(input: DeckInput): Promise<SavedDeck[]> {
  const decks = await loadSavedDecks();
  const existingIndex = input.id ? decks.findIndex((deck) => deck.id === input.id) : -1;
  if (existingIndex >= 0) {
    const existing = decks[existingIndex];
    decks[existingIndex] = {
      ...existing,
      name: input.name,
      cardIds: [...input.cardIds],
      starter: input.starter ?? existing.starter,
      updatedAt: now()
    };
  } else {
    decks.push({
      id: input.id ?? makeId(),
      name: input.name,
      cardIds: [...input.cardIds],
      createdAt: now(),
      updatedAt: now(),
      starter: input.starter ?? false
    });
  }
  await writeDecks(decks);
  return decks;
}

export async function deleteDeck(deckId: string): Promise<SavedDeck[]> {
  const decks = await loadSavedDecks();
  const next = decks.filter((deck) => deck.id !== deckId);
  await writeDecks(next);
  return next;
}

export async function setAllDecks(decks: SavedDeck[]): Promise<void> {
  await writeDecks(decks);
}

function normalizeCivilization(value: string): string {
  return value.trim().toLowerCase();
}

function chooseStarterPool(cards: CardDefinition[], civilization: string): CardDefinition[] {
  const civ = normalizeCivilization(civilization);
  const spellsAndCreatures = cards.filter((card) => {
    const type = card.type.toLowerCase();
    return type === "creature" || type === "spell";
  });
  const mono = spellsAndCreatures.filter(
    (card) => card.civilizations.length === 1 && normalizeCivilization(card.civilizations[0]) === civ
  );
  const multi = spellsAndCreatures.filter((card) => card.civilizations.some((entry) => normalizeCivilization(entry) === civ));
  const rank = (card: CardDefinition): number => card.cost;
  const byName = (a: CardDefinition, b: CardDefinition): number => a.name.localeCompare(b.name);
  return [...mono.sort((a, b) => rank(a) - rank(b) || byName(a, b)), ...multi.sort((a, b) => rank(a) - rank(b) || byName(a, b))];
}

function buildStarterDeckCards(cards: CardDefinition[], civilization: string): string[] {
  const pool = chooseStarterPool(cards, civilization);
  const countsByName = new Map<string, number>();
  const deck: string[] = [];
  let cursor = 0;
  while (deck.length < 40 && cursor < pool.length * 6) {
    const card = pool[cursor % pool.length];
    cursor += 1;
    if (!card) {
      break;
    }
    const current = countsByName.get(card.name) ?? 0;
    if (current >= 4) {
      continue;
    }
    countsByName.set(card.name, current + 1);
    deck.push(card.id);
  }
  return deck.slice(0, 40);
}

export function generateStarterDecks(cards: CardDefinition[]): SavedDeck[] {
  const civilizations = ["Fire", "Water", "Nature", "Light", "Darkness"];
  const generated: SavedDeck[] = [];
  for (const civilization of civilizations) {
    const cardIds = buildStarterDeckCards(cards, civilization);
    if (cardIds.length < 40) {
      continue;
    }
    const stamp = now();
    generated.push({
      id: `starter-${civilization.toLowerCase()}`,
      name: `${civilization} Starter`,
      cardIds,
      createdAt: stamp,
      updatedAt: stamp,
      starter: true
    });
  }
  return generated;
}
