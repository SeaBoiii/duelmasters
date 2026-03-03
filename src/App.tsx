import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { loadCardsWithCache } from "./data/cardSource";
import type { DeckInput } from "./data/deckStore";
import { deleteDeck, generateStarterDecks, loadSavedDecks, setAllDecks, upsertDeck } from "./data/deckStore";
import type { CardDefinition, SavedDeck } from "./data/types";
import { createInitialGameState, reduceGameState } from "./engine/reducer";
import type { GameAction, GameState, PlayerId } from "./engine/types";
import { DeckBuilder } from "./ui/DeckBuilder";
import { DuelBoard } from "./ui/DuelBoard";
import { SettingsAbout } from "./ui/SettingsAbout";

export function App() {
  const [cards, setCards] = useState<CardDefinition[] | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Loading card database...");
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [selectedDeckP1Id, setSelectedDeckP1Id] = useState<string | null>(null);
  const [selectedDeckP2Id, setSelectedDeckP2Id] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const navigate = useNavigate();

  const cardsById = useMemo(() => {
    if (!cards) {
      return {};
    }
    return cards.reduce<Record<string, CardDefinition>>((index, card) => {
      index[card.id] = card;
      return index;
    }, {});
  }, [cards]);

  useEffect(() => {
    let active = true;
    setError(null);
    void loadCardsWithCache({
      onProgress: (message) => {
        if (!active) {
          return;
        }
        setLoadingMessage(message);
      },
      onBackgroundUpdate: (nextCards) => {
        if (!active) {
          return;
        }
        setCards(nextCards);
        setSyncMessage(`Card database refreshed (${nextCards.length} cards).`);
      }
    })
      .then((loadedCards) => {
        if (!active) {
          return;
        }
        setCards(loadedCards);
        setLoadingMessage(`Loaded ${loadedCards.length} cards.`);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load cards.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!cards) {
      return () => {
        active = false;
      };
    }
    void (async () => {
      const existingDecks = await loadSavedDecks();
      if (!active) {
        return;
      }
      if (existingDecks.length > 0) {
        setDecks(existingDecks);
        return;
      }
      const starters = generateStarterDecks(cards);
      if (starters.length > 0) {
        await setAllDecks(starters);
      }
      if (!active) {
        return;
      }
      setDecks(starters);
      setSyncMessage("Starter decks generated.");
    })();
    return () => {
      active = false;
    };
  }, [cards]);

  useEffect(() => {
    if (!selectedDeckP1Id && decks[0]) {
      setSelectedDeckP1Id(decks[0].id);
    }
    if (!selectedDeckP2Id && decks[1]) {
      setSelectedDeckP2Id(decks[1].id);
    } else if (!selectedDeckP2Id && decks[0]) {
      setSelectedDeckP2Id(decks[0].id);
    }
  }, [decks, selectedDeckP1Id, selectedDeckP2Id]);

  const handleSaveDeck = useCallback(async (input: DeckInput) => {
    const updated = await upsertDeck(input);
    setDecks(updated);
  }, []);

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    const updated = await deleteDeck(deckId);
    setDecks(updated);
  }, []);

  const handleGenerateStarters = useCallback(async () => {
    if (!cards) {
      return;
    }
    const starters = generateStarterDecks(cards);
    const existing = await loadSavedDecks();
    const byId = new Map(existing.map((deck) => [deck.id, deck]));
    for (const starter of starters) {
      if (!byId.has(starter.id)) {
        byId.set(starter.id, starter);
      }
    }
    const merged = Array.from(byId.values());
    await setAllDecks(merged);
    setDecks(merged);
    setSyncMessage("Starter decks generated.");
  }, [cards]);

  const dispatch = useCallback((action: GameAction) => {
    setGame((current) => (current ? reduceGameState(current, action) : current));
  }, []);

  const startGame = useCallback(
    (startingPlayerId: PlayerId) => {
      if (!cards || !selectedDeckP1Id || !selectedDeckP2Id) {
        return;
      }
      const deck1 = decks.find((deck) => deck.id === selectedDeckP1Id);
      const deck2 = decks.find((deck) => deck.id === selectedDeckP2Id);
      if (!deck1 || !deck2) {
        setError("Select valid decks for both players.");
        return;
      }
      const p1CardIds = deck1.cardIds.filter((cardId) => !!cardsById[cardId]);
      const p2CardIds = deck2.cardIds.filter((cardId) => !!cardsById[cardId]);
      if (p1CardIds.length < 40 || p2CardIds.length < 40) {
        setError("Decks must have at least 40 valid cards.");
        return;
      }
      const newGame = createInitialGameState(p1CardIds, p2CardIds, cardsById, {
        seed: Date.now(),
        startingPlayerId,
        playerNames: {
          P1: "Player 1",
          P2: "Player 2"
        }
      });
      setGame(newGame);
      setError(null);
      navigate("/duel");
    },
    [cards, cardsById, decks, navigate, selectedDeckP1Id, selectedDeckP2Id]
  );

  if (error && !cards) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Duel Masters Hotseat</h1>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!cards) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>Duel Masters Hotseat</h1>
          <p>{loadingMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-nav">
        <h1>Duel Masters Hotseat</h1>
        <nav className="row gap">
          <NavLink to="/duel">Duel</NavLink>
          <NavLink to="/deck-builder">Deck Builder</NavLink>
          <NavLink to="/settings">Settings/About</NavLink>
        </nav>
      </header>
      {error ? <p className="error-banner">{error}</p> : null}
      {syncMessage ? <p className="status">{syncMessage}</p> : null}

      <Routes>
        <Route path="/" element={<Navigate to="/duel" replace />} />
        <Route
          path="/deck-builder"
          element={
            <DeckBuilder
              cards={cards}
              decks={decks}
              onSaveDeck={handleSaveDeck}
              onDeleteDeck={handleDeleteDeck}
              onGenerateStarters={handleGenerateStarters}
            />
          }
        />
        <Route
          path="/duel"
          element={
            <DuelBoard
              cardsById={cardsById}
              decks={decks}
              selectedDeckP1Id={selectedDeckP1Id}
              selectedDeckP2Id={selectedDeckP2Id}
              onSelectDeck={(playerId, deckId) => {
                if (playerId === "P1") {
                  setSelectedDeckP1Id(deckId);
                } else {
                  setSelectedDeckP2Id(deckId);
                }
              }}
              onStartGame={startGame}
              onResetGame={() => setGame(null)}
              game={game}
              dispatch={dispatch}
            />
          }
        />
        <Route path="/settings" element={<SettingsAbout />} />
      </Routes>
    </main>
  );
}
