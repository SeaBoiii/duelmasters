import { memo, useMemo, useState } from "react";
import type { CardDefinition, SavedDeck } from "../data/types";
import { formatPower } from "../engine/rules";
import { Modal } from "./components/Modal";
import { CardFull } from "./components/cards/CardFull";
import { CivPips } from "./components/cards/CivPips";
import { KeywordBadges } from "./components/cards/KeywordBadges";
import type { DeckInput } from "../data/deckStore";

interface DeckBuilderProps {
  cards: CardDefinition[];
  decks: SavedDeck[];
  onSaveDeck: (deck: DeckInput) => Promise<void> | void;
  onDeleteDeck: (deckId: string) => Promise<void> | void;
  onGenerateStarters: () => Promise<void> | void;
}

type DeckMap = Record<string, number>;

interface DeckSearchRowProps {
  card: CardDefinition;
  copies: number;
  onAdd: (card: CardDefinition) => void;
  onPreview: (card: CardDefinition, x: number, y: number) => void;
  onLeave: () => void;
  onOpenInfo: (card: CardDefinition) => void;
}

const DeckSearchRow = memo(function DeckSearchRow({ card, copies, onAdd, onPreview, onLeave, onOpenInfo }: DeckSearchRowProps) {
  return (
    <div
      className="search-row card-search-row"
      onMouseEnter={(event) => onPreview(card, event.clientX, event.clientY)}
      onMouseMove={(event) => onPreview(card, event.clientX, event.clientY)}
      onMouseLeave={onLeave}
    >
      <div className="search-row-main">
        <div className="row gap wrap">
          <span className="pill">Cost {card.cost}</span>
          <strong>{card.name}</strong>
          <span className="muted">{card.type}</span>
          <CivPips civilizations={card.civilizations} />
          <span className="pill">Power {formatPower(card.powerBase, card.powerHasPlus)}</span>
        </div>
        <KeywordBadges card={card} />
      </div>
      <div className="row gap">
        <button type="button" className="secondary card-info-btn" onClick={() => onOpenInfo(card)}>
          Info
        </button>
        <button type="button" onClick={() => onAdd(card)} disabled={copies >= 4}>
          {copies >= 4 ? "Max 4" : "Add"}
        </button>
      </div>
    </div>
  );
});

function deckMapFromCardIds(cardIds: string[]): DeckMap {
  return cardIds.reduce<DeckMap>((accumulator, cardId) => {
    accumulator[cardId] = (accumulator[cardId] ?? 0) + 1;
    return accumulator;
  }, {});
}

function deckMapToCardIds(deckMap: DeckMap): string[] {
  const ids: string[] = [];
  for (const [cardId, count] of Object.entries(deckMap)) {
    for (let i = 0; i < count; i += 1) {
      ids.push(cardId);
    }
  }
  return ids;
}

function countDeckCards(deckMap: DeckMap): number {
  return Object.values(deckMap).reduce((sum, count) => sum + count, 0);
}

interface PreviewState {
  card: CardDefinition;
  x: number;
  y: number;
}

function clampPreview(x: number, y: number): { x: number; y: number } {
  const width = 420;
  const height = 620;
  const margin = 12;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.min(maxX, Math.max(margin, x + 16)),
    y: Math.min(maxY, Math.max(margin, y + 16))
  };
}

export function DeckBuilder({ cards, decks, onSaveDeck, onDeleteDeck, onGenerateStarters }: DeckBuilderProps) {
  const cardIndex = useMemo<Record<string, CardDefinition>>(
    () =>
      cards.reduce<Record<string, CardDefinition>>((index, card) => {
        index[card.id] = card;
        return index;
      }, {}),
    [cards]
  );

  const uniqueTypes = useMemo(() => {
    const values = new Set(cards.map((card) => card.type));
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [cards]);

  const [deckName, setDeckName] = useState("My Deck");
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [deckMap, setDeckMap] = useState<DeckMap>({});
  const [search, setSearch] = useState("");
  const [civilizationFilters, setCivilizationFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | "creature" | "spell">("all");
  const [costMin, setCostMin] = useState(0);
  const [costMax, setCostMax] = useState(12);
  const [message, setMessage] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<PreviewState | null>(null);
  const [mobilePreviewCard, setMobilePreviewCard] = useState<CardDefinition | null>(null);

  const deckCardIds = useMemo(() => deckMapToCardIds(deckMap), [deckMap]);
  const deckSize = deckCardIds.length;

  const nameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cardId of deckCardIds) {
      const card = cardIndex[cardId];
      if (!card) {
        continue;
      }
      counts.set(card.name, (counts.get(card.name) ?? 0) + 1);
    }
    return counts;
  }, [cardIndex, deckCardIds]);

  const groupedDeckRows = useMemo(() => {
    const byName = new Map<string, { name: string; count: number; sampleId: string; cost: number }>();
    for (const [cardId, count] of Object.entries(deckMap)) {
      const card = cardIndex[cardId];
      if (!card) {
        continue;
      }
      const existing = byName.get(card.name);
      if (existing) {
        existing.count += count;
      } else {
        byName.set(card.name, {
          name: card.name,
          count,
          sampleId: cardId,
          cost: card.cost
        });
      }
    }
    return Array.from(byName.values()).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }, [cardIndex, deckMap]);

  const civilizations = useMemo(() => ["Fire", "Water", "Nature", "Light", "Darkness"], []);

  const filteredCards = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return cards
      .filter((card) => {
        if (lowerSearch && !card.name.toLowerCase().includes(lowerSearch)) {
          return false;
        }
        if (typeFilter !== "all" && card.type !== typeFilter) {
          return false;
        }
        if (kindFilter !== "all" && card.type.toLowerCase() !== kindFilter) {
          return false;
        }
        if (card.cost < costMin || card.cost > costMax) {
          return false;
        }
        if (
          civilizationFilters.length > 0 &&
          !civilizationFilters.every((selected) => card.civilizations.some((civ) => civ.toLowerCase() === selected.toLowerCase()))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
      .slice(0, 350);
  }, [cards, civilizationFilters, costMax, costMin, kindFilter, search, typeFilter]);

  const canSave = deckSize >= 40 && deckName.trim().length > 0;
  const deckStatusMessage = deckSize >= 40 ? `Deck valid (${deckSize} cards).` : `${deckSize}/40 cards`;

  function setFeedback(next: string): void {
    setMessage(next);
    window.setTimeout(() => {
      setMessage((current) => (current === next ? null : current));
    }, 2800);
  }

  function addCard(card: CardDefinition): void {
    const byName = nameCounts.get(card.name) ?? 0;
    if (byName >= 4) {
      setFeedback(`Cannot add ${card.name}: 4-copy limit reached.`);
      return;
    }
    setDeckMap((current) => ({
      ...current,
      [card.id]: (current[card.id] ?? 0) + 1
    }));
  }

  function removeCard(cardId: string): void {
    setDeckMap((current) => {
      const existing = current[cardId] ?? 0;
      if (existing <= 1) {
        const next = { ...current };
        delete next[cardId];
        return next;
      }
      return {
        ...current,
        [cardId]: existing - 1
      };
    });
  }

  function clearDeck(): void {
    setDeckMap({});
    setDeckName("My Deck");
    setEditingDeckId(null);
  }

  function loadDeck(deck: SavedDeck): void {
    setDeckName(deck.name);
    setEditingDeckId(deck.id);
    setDeckMap(deckMapFromCardIds(deck.cardIds));
  }

  async function saveDeck(): Promise<void> {
    const cardIds = deckMapToCardIds(deckMap);
    const nameViolations = Array.from(nameCounts.values()).some((count) => count > 4);
    if (nameViolations) {
      setFeedback("Deck has more than 4 copies of at least one card name.");
      return;
    }
    if (cardIds.length < 40) {
      setFeedback("Deck must have at least 40 cards.");
      return;
    }
    await onSaveDeck({
      id: editingDeckId ?? undefined,
      name: deckName.trim(),
      cardIds,
      starter: false
    });
    setFeedback("Deck saved.");
  }

  function toggleCivilization(value: string): void {
    setCivilizationFilters((current) => {
      if (current.includes(value)) {
        return current.filter((entry) => entry !== value);
      }
      return [...current, value];
    });
  }

  function handlePreview(card: CardDefinition, cursorX: number, cursorY: number): void {
    if (window.matchMedia("(hover: hover)").matches) {
      const position = clampPreview(cursorX, cursorY);
      setHoverPreview({
        card,
        x: position.x,
        y: position.y
      });
    }
  }

  return (
    <div className="screen-grid">
      <section className="panel">
        <h2>Card Search</h2>
        <div className="row wrap gap">
          <label>
            Name
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search card name" />
          </label>
          <label>
            Type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {uniqueTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kind
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | "creature" | "spell")}>
              <option value="all">All</option>
              <option value="creature">Creature</option>
              <option value="spell">Spell</option>
            </select>
          </label>
          <label>
            Cost Min
            <input type="number" min={0} max={20} value={costMin} onChange={(event) => setCostMin(Number(event.target.value) || 0)} />
          </label>
          <label>
            Cost Max
            <input type="number" min={0} max={20} value={costMax} onChange={(event) => setCostMax(Number(event.target.value) || 0)} />
          </label>
        </div>

        <fieldset className="inline-fieldset">
          <legend>Civilizations</legend>
          <div className="row wrap gap">
            {civilizations.map((civilization) => (
              <label key={civilization} className="small-check">
                <input
                  type="checkbox"
                  checked={civilizationFilters.includes(civilization)}
                  onChange={() => toggleCivilization(civilization)}
                />
                {civilization}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="muted">Showing {filteredCards.length} results (capped).</p>
        <div className="search-results" onMouseLeave={() => setHoverPreview(null)}>
          {filteredCards.map((card) => {
            const copies = nameCounts.get(card.name) ?? 0;
            return (
              <DeckSearchRow
                key={card.id}
                card={card}
                copies={copies}
                onAdd={addCard}
                onPreview={handlePreview}
                onLeave={() => setHoverPreview(null)}
                onOpenInfo={(previewCard) => setMobilePreviewCard(previewCard)}
              />
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Deck Builder</h2>
        <div className="row wrap gap">
          <label>
            Deck name
            <input value={deckName} onChange={(event) => setDeckName(event.target.value)} />
          </label>
          <button type="button" onClick={saveDeck} disabled={!canSave}>
            Save Deck
          </button>
          <button type="button" className="secondary" onClick={clearDeck}>
            New Deck
          </button>
          <button type="button" className="secondary" onClick={() => void onGenerateStarters()}>
            Generate Starters
          </button>
        </div>
        <p>
          Deck status: <strong>{deckStatusMessage}</strong> (minimum 40, max 4 copies by card name)
        </p>
        {deckSize < 40 ? <p className="error-banner">Deck is not legal: add {40 - deckSize} more cards.</p> : null}
        {message ? <p className="status">{message}</p> : null}

        <div className="deck-list">
          {groupedDeckRows.map((row) => (
            <div className="search-row" key={row.name}>
              <div>
                <strong>{row.name}</strong> x{row.count}
              </div>
              <button type="button" className="secondary" onClick={() => removeCard(row.sampleId)}>
                Remove 1
              </button>
            </div>
          ))}
        </div>

        <h3>Saved Decks</h3>
        <div className="deck-list">
          {decks.map((deck) => (
            <div key={deck.id} className="search-row">
              <div>
                <strong>{deck.name}</strong> ({countDeckCards(deckMapFromCardIds(deck.cardIds))} cards)
                {deck.starter ? <span className="pill">Starter</span> : null}
              </div>
              <div className="row gap">
                <button type="button" onClick={() => loadDeck(deck)}>
                  Load
                </button>
                {!deck.starter ? (
                  <button type="button" className="danger" onClick={() => void onDeleteDeck(deck.id)}>
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {hoverPreview ? (
        <div className="deck-hover-preview" style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px` }}>
          <CardFull card={hoverPreview.card} />
        </div>
      ) : null}

      <Modal title="Card Preview" open={!!mobilePreviewCard} onClose={() => setMobilePreviewCard(null)}>
        {mobilePreviewCard ? <CardFull card={mobilePreviewCard} /> : null}
      </Modal>
    </div>
  );
}
