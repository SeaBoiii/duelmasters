import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CardDefinition, SavedDeck } from "../data/types";
import { canCreatureAttack, getOpponentId } from "../engine/selectors";
import type { GameAction, GameState, PlayerId } from "../engine/types";
import { LogPanel } from "./components/LogPanel";
import { ManaPaymentModal } from "./components/ManaPaymentModal";
import { Modal } from "./components/Modal";
import { CardFull } from "./components/cards/CardFull";
import { CardMini } from "./components/cards/CardMini";
import { CivPips } from "./components/cards/CivPips";

interface DuelBoardProps {
  cardsById: Record<string, CardDefinition>;
  decks: SavedDeck[];
  selectedDeckP1Id: string | null;
  selectedDeckP2Id: string | null;
  onSelectDeck: (playerId: PlayerId, deckId: string) => void;
  onStartGame: (startingPlayerId: PlayerId) => void;
  onResetGame: () => void;
  game: GameState | null;
  dispatch: (action: GameAction) => void;
  cardsReady: boolean;
  loadingMessage: string;
  onRetryCardLoad?: () => void;
}

export function DuelBoard({
  cardsById,
  decks,
  selectedDeckP1Id,
  selectedDeckP2Id,
  onSelectDeck,
  onStartGame,
  onResetGame,
  game,
  dispatch,
  cardsReady,
  loadingMessage,
  onRetryCardLoad
}: DuelBoardProps) {
  const [handActionCardId, setHandActionCardId] = useState<string | null>(null);
  const [attackingCreatureId, setAttackingCreatureId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedDeckP1 = selectedDeckP1Id ? decks.find((deck) => deck.id === selectedDeckP1Id) ?? null : null;
  const selectedDeckP2 = selectedDeckP2Id ? decks.find((deck) => deck.id === selectedDeckP2Id) ?? null : null;
  const selectedDeckP1Valid = selectedDeckP1 ? selectedDeckP1.cardIds.filter((cardId) => !!cardsById[cardId]).length : 0;
  const selectedDeckP2Valid = selectedDeckP2 ? selectedDeckP2.cardIds.filter((cardId) => !!cardsById[cardId]).length : 0;
  const invalidDeckMessage = (() => {
    if (!selectedDeckP1 || !selectedDeckP2) {
      return null;
    }
    if (selectedDeckP1Valid < 40 || selectedDeckP2Valid < 40) {
      return `Selected deck is invalid for duel: P1 has ${selectedDeckP1Valid} valid cards, P2 has ${selectedDeckP2Valid}. Need at least 40 valid cards each.`;
    }
    return null;
  })();

  if (!game) {
    if (!cardsReady) {
      return (
        <section className="panel">
          <h2>Duel Boot</h2>
          <p>{loadingMessage}</p>
          <div className="row wrap gap">
            {onRetryCardLoad ? (
              <button type="button" onClick={onRetryCardLoad}>
                Retry Card Load
              </button>
            ) : null}
          </div>
        </section>
      );
    }
    if (decks.length === 0) {
      return (
        <section className="panel">
          <h2>Duel Boot</h2>
          <p>No decks available. Build or generate a deck first.</p>
          <Link to="/deck-builder" className="inline-link-button">
            Go to Deck Builder
          </Link>
        </section>
      );
    }
    return (
      <section className="panel">
        <h2>Duel Boot</h2>
        <p>Choose two saved decks and start a hotseat match.</p>
        {invalidDeckMessage ? <p className="error-banner">{invalidDeckMessage}</p> : null}
        {invalidDeckMessage ? (
          <Link to="/deck-builder" className="inline-link-button">
            Fix Decks in Deck Builder
          </Link>
        ) : null}
        <div className="row wrap gap">
          <label>
            Player 1 Deck
            <select value={selectedDeckP1Id ?? ""} onChange={(event) => onSelectDeck("P1", event.target.value)}>
              <option value="">Select deck</option>
              {decks.map((deck) => (
                <option value={deck.id} key={`p1-${deck.id}`}>
                  {deck.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Player 2 Deck
            <select value={selectedDeckP2Id ?? ""} onChange={(event) => onSelectDeck("P2", event.target.value)}>
              <option value="">Select deck</option>
              {decks.map((deck) => (
                <option value={deck.id} key={`p2-${deck.id}`}>
                  {deck.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!selectedDeckP1Id || !selectedDeckP2Id || !!invalidDeckMessage} onClick={() => onStartGame("P1")}>
            Start (P1 first)
          </button>
          <button type="button" disabled={!selectedDeckP1Id || !selectedDeckP2Id || !!invalidDeckMessage} onClick={() => onStartGame("P2")}>
            Start (P2 first)
          </button>
        </div>
      </section>
    );
  }

  const gameState = game;
  const duelCardsById = gameState.cardIndex;
  const activePlayer = gameState.players[gameState.activePlayerId];
  const opponentId = getOpponentId(gameState.activePlayerId);
  const opponent = gameState.players[opponentId];
  const handCardInstance = handActionCardId ? activePlayer.hand.find((card) => card.instanceId === handActionCardId) ?? null : null;
  const handCardDefinition = handCardInstance ? duelCardsById[handCardInstance.cardId] ?? null : null;
  const detailCard = detailCardId ? duelCardsById[detailCardId] ?? null : null;
  const manaPrompt = gameState.pendingPayment;
  const blockerPrompt = gameState.pendingPrompt?.type === "blocker" ? gameState.pendingPrompt : null;
  const triggerPrompt = gameState.pendingPrompt?.type === "shieldTrigger" ? gameState.pendingPrompt : null;
  const triggerCard =
    triggerPrompt
      ? (() => {
          const owner = gameState.players[triggerPrompt.playerId];
          const instance = owner.hand.find((card) => card.instanceId === triggerPrompt.handInstanceId);
          return instance ? duelCardsById[instance.cardId] ?? null : null;
        })()
      : null;

  const blockerChoices =
    blockerPrompt
      ? blockerPrompt.blockers
          .map((instanceId) => gameState.players[blockerPrompt.defenderId].battle.find((card) => card.instanceId === instanceId))
          .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      : [];

  const attackTargets = (() => {
    if (!attackingCreatureId) {
      return [];
    }
    const targets = [
      {
        id: `player-${opponent.id}`,
        label: `Attack ${opponent.name}`,
        action: () =>
          dispatch({
            type: "DECLARE_ATTACK",
            attackerId: attackingCreatureId,
            target: { kind: "player", playerId: opponent.id }
          })
      }
    ];
    for (const creature of opponent.battle) {
      if (!creature.tapped) {
        continue;
      }
      const card = duelCardsById[creature.cardId];
      targets.push({
        id: creature.instanceId,
        label: `Attack tapped creature: ${card?.name ?? "Unknown"}`,
        action: () =>
          dispatch({
            type: "DECLARE_ATTACK",
            attackerId: attackingCreatureId,
            target: { kind: "creature", creatureId: creature.instanceId }
          })
      });
    }
    return targets;
  })();

  function showToast(message: string): void {
    setToast(message);
  }

  function handleAdvance(): void {
    if (gameState.winnerId) {
      showToast("Game is over.");
      return;
    }
    if (gameState.pendingPrompt || gameState.pendingPayment) {
      showToast("Resolve pending choices first.");
      return;
    }
    dispatch({ type: "ADVANCE" });
  }

  const advanceLabel =
    gameState.phase === "END"
      ? "Pass Turn"
      : gameState.phase === "UNTAP" || gameState.phase === "DRAW"
        ? "Advance (Auto)"
        : gameState.phase === "MANA"
          ? "Skip Mana Charge"
        : "Next Phase";

  function attemptCharge(cardInstanceId: string): void {
    if (gameState.phase !== "MANA") {
      showToast("Mana charge is only allowed during MANA phase.");
      return;
    }
    if (gameState.chargedManaThisTurn) {
      showToast("You already charged mana this turn.");
      return;
    }
    if (gameState.pendingPrompt || gameState.pendingPayment) {
      showToast("Resolve current prompt first.");
      return;
    }
    dispatch({ type: "CHARGE_MANA", handInstanceId: cardInstanceId });
    setHandActionCardId(null);
  }

  function attemptCastOrSummon(cardInstanceId: string): void {
    if (gameState.phase !== "MAIN") {
      showToast("Cast/Summon is only allowed during MAIN phase.");
      return;
    }
    if (gameState.pendingPrompt || gameState.pendingPayment) {
      showToast("Resolve current prompt first.");
      return;
    }
    dispatch({ type: "REQUEST_PLAY_CARD", handInstanceId: cardInstanceId });
    setHandActionCardId(null);
  }

  function renderShieldSlots(playerId: PlayerId): JSX.Element {
    const player = gameState.players[playerId];
    return (
      <div className="shield-row">
        {Array.from({ length: 5 }, (_, index) => {
          const isFilled = index < player.shields.length;
          return (
            <div key={`${playerId}-shield-${index}`} className={`shield-slot ${isFilled ? "filled" : "empty"}`}>
              {isFilled ? <img src={`${import.meta.env.BASE_URL}card-back.svg`} alt="Shield" /> : <span />}
            </div>
          );
        })}
      </div>
    );
  }

  function renderManaTiles(playerId: PlayerId): JSX.Element {
    const player = gameState.players[playerId];
    return (
      <div className="mana-tile-row">
        {player.mana.map((instance) => {
          const card = duelCardsById[instance.cardId] ?? null;
          return (
            <button
              type="button"
              key={instance.instanceId}
              className={`mana-tile ${instance.tapped ? "tapped" : "untapped"}`}
              onMouseEnter={() => setDetailCardId(instance.cardId)}
              onFocus={() => setDetailCardId(instance.cardId)}
              onClick={() => setDetailCardId(instance.cardId)}
              aria-label={`Mana card ${card?.name ?? "Unknown"}`}
            >
              <CivPips civilizations={card?.civilizations ?? []} />
            </button>
          );
        })}
      </div>
    );
  }

  function renderBattleCards(playerId: PlayerId): JSX.Element {
    const player = gameState.players[playerId];
    return (
      <div className="battle-card-row">
        {player.battle.map((instance) => {
          const card = duelCardsById[instance.cardId] ?? null;
          const canAttack = playerId === gameState.activePlayerId && canCreatureAttack(gameState, instance) && gameState.phase === "BATTLE";
          return (
            <div className="stacked-card" key={instance.instanceId}>
              <CardMini card={card} instance={instance} onClick={() => setDetailCardId(instance.cardId)} selected={detailCardId === instance.cardId} />
              {playerId === gameState.activePlayerId ? (
                <button
                  type="button"
                  className="tiny-button"
                  onClick={() => {
                    if (!canAttack) {
                      showToast("Creature cannot attack right now.");
                      return;
                    }
                    setAttackingCreatureId(instance.instanceId);
                  }}
                >
                  Attack
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="duel-layout board-layout">
      <section className="panel board-main">
        <section className="field-side opponent-side">
          <header className="field-header">
            <h3>{opponent.name}</h3>
            <div className="field-counts">
              <span className="pill">Hand {opponent.hand.length}</span>
              <span className="pill">Deck {opponent.deck.length}</span>
              <span className="pill">Grave {opponent.graveyard.length}</span>
            </div>
          </header>
          <div className="zone-block">
            <h4>Shields</h4>
            {renderShieldSlots(opponentId)}
          </div>
          <div className="zone-block">
            <h4>Battle Zone</h4>
            {renderBattleCards(opponentId)}
          </div>
          <div className="zone-block">
            <h4>Mana Zone ({opponent.mana.length})</h4>
            {renderManaTiles(opponentId)}
          </div>
        </section>

        <section className="field-side player-side">
          <header className="field-header">
            <h3>{activePlayer.name}</h3>
            <div className="field-counts">
              <span className="pill">Hand {activePlayer.hand.length}</span>
              <span className="pill">Deck {activePlayer.deck.length}</span>
              <span className="pill">Grave {activePlayer.graveyard.length}</span>
            </div>
          </header>
          <div className="zone-block">
            <h4>Shields</h4>
            {renderShieldSlots(gameState.activePlayerId)}
          </div>
          <div className="zone-block">
            <h4>Battle Zone</h4>
            {renderBattleCards(gameState.activePlayerId)}
          </div>
          <div className="zone-block">
            <h4>Mana Zone ({activePlayer.mana.length})</h4>
            {renderManaTiles(gameState.activePlayerId)}
          </div>
          <div className="zone-block">
            <h4>Hand</h4>
            <div className="hand-card-row">
              {activePlayer.hand.map((instance) => (
                <CardMini
                  key={instance.instanceId}
                  card={duelCardsById[instance.cardId] ?? null}
                  onClick={() => setHandActionCardId(instance.instanceId)}
                  selected={handActionCardId === instance.instanceId}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="panel log-wrapper">
          <LogPanel entries={gameState.log} />
        </section>
      </section>

      <aside className="panel side-panel phase-panel">
        <h2>Current Turn</h2>
        <p className="phase-owner">Active Player: {activePlayer.name}</p>
        <p className="phase-big">CURRENT PHASE: {gameState.phase}</p>
        <p>Turn {gameState.turnNumber}</p>
        {gameState.phase === "MANA" ? <p className="muted">Charge one card to mana, or skip to MAIN.</p> : null}
        {gameState.winnerId ? <p className="status">Winner: {gameState.players[gameState.winnerId].name}</p> : null}
        <div className="column gap">
          <button type="button" onClick={handleAdvance} disabled={!!gameState.winnerId}>
            {advanceLabel}
          </button>
          <button type="button" className="secondary" onClick={onResetGame}>
            New Duel
          </button>
          <button type="button" className="danger" onClick={() => dispatch({ type: "CONCEDE", playerId: gameState.activePlayerId })}>
            Concede
          </button>
        </div>
        <h3>Card Detail</h3>
        {detailCard ? <CardFull card={detailCard} /> : <p className="muted">Hover or tap a card/mana tile to inspect.</p>}
      </aside>

      {toast ? (
        <div className="toast-banner" role="status">
          {toast}
        </div>
      ) : null}

      <Modal title="Hand Action" open={!!handCardDefinition} onClose={() => setHandActionCardId(null)}>
        {handCardDefinition && handCardInstance ? (
          <div className="column gap">
            <CardFull card={handCardDefinition} instance={handCardInstance} />
            <div className="row wrap gap">
              <button type="button" onClick={() => attemptCharge(handCardInstance.instanceId)}>
                Charge to Mana
              </button>
              <button type="button" onClick={() => attemptCastOrSummon(handCardInstance.instanceId)}>
                Cast / Summon
              </button>
              <button type="button" className="secondary" onClick={() => setHandActionCardId(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Choose Attack Target" open={!!attackingCreatureId} onClose={() => setAttackingCreatureId(null)}>
        <div className="column gap">
          {attackTargets.length === 0 ? <p>No legal targets.</p> : null}
          {attackTargets.map((target) => (
            <button
              type="button"
              key={target.id}
              onClick={() => {
                target.action();
                setAttackingCreatureId(null);
              }}
            >
              {target.label}
            </button>
          ))}
        </div>
      </Modal>

      <ManaPaymentModal
        open={!!manaPrompt}
        prompt={manaPrompt}
        player={manaPrompt ? gameState.players[manaPrompt.playerId] : null}
        cardIndex={duelCardsById}
        onToggleMana={(instanceId) => dispatch({ type: "TOGGLE_MANA_SELECTION", manaInstanceId: instanceId })}
        onConfirm={() => dispatch({ type: "CONFIRM_MANA_PAYMENT" })}
        onCancel={() => dispatch({ type: "CANCEL_MANA_PAYMENT" })}
      />

      <Modal title="Choose Blocker" open={!!blockerPrompt}>
        <p>{blockerPrompt ? `${gameState.players[blockerPrompt.defenderId].name}, choose a blocker or decline.` : ""}</p>
        <div className="column gap">
          {blockerChoices.map((blocker) => {
            const card = duelCardsById[blocker.cardId] ?? null;
            return (
              <button type="button" key={blocker.instanceId} onClick={() => dispatch({ type: "CHOOSE_BLOCKER", blockerId: blocker.instanceId })}>
                Block with {card?.name ?? "Unknown"}
              </button>
            );
          })}
          <button type="button" className="secondary" onClick={() => dispatch({ type: "CHOOSE_BLOCKER", blockerId: null })}>
            No block
          </button>
        </div>
      </Modal>

      <Modal title="Shield Trigger" open={!!triggerPrompt}>
        {triggerCard ? (
          <div className="column gap">
            <CardFull card={triggerCard} />
            <p>Activate Shield Trigger?</p>
            <div className="row gap">
              <button type="button" onClick={() => dispatch({ type: "RESOLVE_SHIELD_TRIGGER", activate: true })}>
                Yes
              </button>
              <button type="button" className="secondary" onClick={() => dispatch({ type: "RESOLVE_SHIELD_TRIGGER", activate: false })}>
                No
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
