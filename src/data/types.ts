export interface RawCardPrinting {
  set: string;
  id: string;
  rarity: string;
  illustrator: string;
  flavor?: string;
}

export interface RawCardEntry {
  name: string;
  type: string;
  cost: number;
  civilizations: string[];
  text: string;
  power?: string;
  subtypes?: string[];
  supertypes?: string[];
  printings: RawCardPrinting[];
}

export interface RawCardDataset {
  $schema: string;
  cards: RawCardEntry[];
}

export interface KeywordFlags {
  blocker: boolean;
  charger: boolean;
  doubleBreaker: boolean;
  powerAttackerBonus: number;
  shieldTrigger: boolean;
  slayer: boolean;
  tripleBreaker: boolean;
}

export interface CardDefinition {
  id: string;
  name: string;
  type: string;
  cost: number;
  civilizations: string[];
  text: string;
  powerRaw: string | null;
  powerBase: number | null;
  powerHasPlus: boolean;
  subtypes: string[];
  supertypes: string[];
  printings: RawCardPrinting[];
  primaryPrinting: RawCardPrinting | null;
  keywords: KeywordFlags;
}

export interface CardsCacheEntry {
  cards: CardDefinition[];
  fetchedAt: number;
}

export interface SavedDeck {
  id: string;
  name: string;
  cardIds: string[];
  createdAt: number;
  updatedAt: number;
  starter: boolean;
}
