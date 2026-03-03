import { useMemo, useState } from "react";
import type { CardDefinition, SavedDeck } from "../data/types";
import { PHASE_ORDER } from "../engine/reducer";
import { canCreatureAttack, getOpponentId } from "../engine/selectors";
import type { GameAction, GameState, PlayerId, ZoneName } from "../engine/types";
import { CardView } from "./components/CardView";
import { LogPanel } from "./components/LogPanel";
import { ManaPaymentModal } from "./components/ManaPaymentModal";
import { Modal } from "./components/Modal";
import { ZoneView } from "./components/ZoneView";

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
}

type ZoneInspector = {
  playerId: PlayerId;
  zone: ZoneName;
};

function nextPhaseLabel(phase: string): string {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < 0 || idx === PHASE_ORDER.length - 1) {
    return "End Turn";
  }
  return `Next: ${PHASE_ORDER[idx + 1]}`;
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
  dispatch
}: DuelBoardProps) {
  const [handActionCardId, setHandActionCardId] = useState<string | null>(null);
  const [attackingCreatureId, setAttackingCreatureId] = useState<string | null>(null);
  const [inspector, setInspector] = useState<ZoneInspector | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);

  if (!game) {
    return (
      <section className="panel">
        <h2>Start Duel</h2>
        <p>Choose two saved decks and start a hotseat match.</p>
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
          <button type="button" disabled={!selectedDeckP1Id || !selectedDeckP2Id} onClick={() => onStartGame("P1")}>
            Start (P1 first)
          </button>
          <button type="button" disabled={!selectedDeckP1Id || !selectedDeckP2Id} onClick={() => onStartGame("P2")}>
            Start (P2 first)
          </button>
        </div>
      </section>
    );
  }

  const gameState = game;
  const activePlayer = gameState.players[gameState.activePlayerId];
  const defendingPlayerId = getOpponentId(gameState.activePlayerId);
  const defendingPlayer = gameState.players[defendingPlayerId];
  const canAdvancePhase = !gameState.pendingPrompt && !gameState.winnerId;

  const attackTargets = useMemo(() => {
    if (!attackingCreatureId) {
      return [];
    }
    const targets = [
      {
        id: `player-${defendingPlayer.id}`,
        label: `Attack ${defendingPlayer.name}`,
        action: () =>
          dispatch({
            type: "DECLARE_ATTACK",
            attackerId: attackingCreatureId,
            target: { kind: "player", playerId: defendingPlayer.id }
          })
      }
    ];
    for (const creature of defendingPlayer.battle) {
      if (!creature.tapped) {
        continue;
      }
      const card = cardsById[creature.cardId];
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
  }, [attackingCreatureId, cardsById, defendingPlayer, dispatch]);

  const handCardInstance = handActionCardId ? activePlayer.hand.find((card) => card.instanceId === handActionCardId) ?? null : null;
  const handCardDefinition = handCardInstance ? cardsById[handCardInstance.cardId] ?? null : null;

  const inspectedCards =
    inspector
      ? gameState.players[inspector.playerId][inspector.zone].map((instance) => ({
          instance,
          card: cardsById[instance.cardId] ?? null
        }))
      : [];

  const detailCard = detailCardId ? cardsById[detailCardId] ?? null : null;

  const manaPrompt = gameState.pendingPrompt?.type === "manaPayment" ? gameState.pendingPrompt : null;
  const blockerPrompt = gameState.pendingPrompt?.type === "blocker" ? gameState.pendingPrompt : null;
  const triggerPrompt = gameState.pendingPrompt?.type === "shieldTrigger" ? gameState.pendingPrompt : null;

  const triggerCard =
    triggerPrompt ? (() => {
      const owner = gameState.players[triggerPrompt.playerId];
      const instance = owner.hand.find((card) => card.instanceId === triggerPrompt.handInstanceId);
      return instance ? cardsById[instance.cardId] ?? null : null;
    })() : null;

  const blockerChoices =
    blockerPrompt
      ? blockerPrompt.blockers
          .map((instanceId) => gameState.players[blockerPrompt.defenderId].battle.find((card) => card.instanceId === instanceId))
          .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      : [];

  function renderBattleZone(playerId: PlayerId): JSX.Element {
    const player = gameState.players[playerId];
    return (
      <ZoneView title={`${player.name} Battle Zone`} count={player.battle.length} onInspect={() => setInspector({ playerId, zone: "battle" })}>
        <div className="card-row">
          {player.battle.map((instance) => {
            const card = cardsById[instance.cardId] ?? null;
            const attackReady = playerId === gameState.activePlayerId && gameState.phase === "BATTLE" && canCreatureAttack(gameState, instance);
            return (
              <div className="stacked-card" key={instance.instanceId}>
                <CardView
                  card={card}
                  instance={instance}
                  compact
                  onClick={() => setDetailCardId(instance.cardId)}
                  selected={detailCardId === instance.cardId}
                />
                {attackReady ? (
                  <button type="button" onClick={() => setAttackingCreatureId(instance.instanceId)}>
                    Attack
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </ZoneView>
    );
  }

  function renderManaZone(playerId: PlayerId): JSX.Element {
    const player = gameState.players[playerId];
    return (
      <ZoneView title={`${player.name} Mana Zone`} count={player.mana.length} onInspect={() => setInspector({ playerId, zone: "mana" })}>
        <div className="card-row">
          {player.mana.map((instance) => (
            <CardView
              key={instance.instanceId}
              card={cardsById[instance.cardId] ?? null}
              instance={instance}
              compact
              onClick={() => setDetailCardId(instance.cardId)}
              selected={detailCardId === instance.cardId}
            />
          ))}
        </div>
      </ZoneView>
    );
  }

  function renderShields(playerId: PlayerId): JSX.Element {
    const player = gameState.players[playerId];
    return (
      <ZoneView title={`${player.name} Shields`} count={player.shields.length}>
        <div className="card-row">
          {player.shields.map((instance) => (
            <CardView key={instance.instanceId} card={null} hidden compact />
          ))}
        </div>
      </ZoneView>
    );
  }

  return (
    <div className="duel-layout">
      <section className="panel">
        <header className="row wrap gap">
          <h2>Duel</h2>
          <span className="pill">Turn {gameState.turnNumber}</span>
          <span className="pill">Phase {gameState.phase}</span>
          <span className="pill">
            Active: {activePlayer.name}
          </span>
          {gameState.winnerId ? <span className="pill good">Winner: {gameState.players[gameState.winnerId].name}</span> : null}
        </header>

        <div className="row wrap gap">
          <button type="button" disabled={!canAdvancePhase} onClick={() => dispatch({ type: "NEXT_PHASE" })}>
            {nextPhaseLabel(gameState.phase)}
          </button>
          <button type="button" className="secondary" onClick={onResetGame}>
            New Duel
          </button>
          {!gameState.winnerId ? (
            <button type="button" className="danger" onClick={() => dispatch({ type: "CONCEDE", playerId: gameState.activePlayerId })}>
              Concede (Active Player)
            </button>
          ) : null}
        </div>

        <div className="battlefield">
          <section className="player-row opponent">
            <h3>{defendingPlayer.name}</h3>
            <div className="row wrap gap">
              <ZoneView title="Deck" count={defendingPlayer.deck.length} />
              <ZoneView title="Hand" count={defendingPlayer.hand.length} />
              {renderShields(defendingPlayerId)}
              {renderManaZone(defendingPlayerId)}
              {renderBattleZone(defendingPlayerId)}
              <ZoneView
                title="Graveyard"
                count={defendingPlayer.graveyard.length}
                onInspect={() => setInspector({ playerId: defendingPlayerId, zone: "graveyard" })}
              />
            </div>
          </section>

          <section className="player-row active">
            <h3>{activePlayer.name}</h3>
            <div className="row wrap gap">
              <ZoneView title="Deck" count={activePlayer.deck.length} />
              <ZoneView title="Hand" count={activePlayer.hand.length} onInspect={() => setInspector({ playerId: gameState.activePlayerId, zone: "hand" })}>
                <div className="card-row">
                  {activePlayer.hand.map((instance) => (
                    <CardView
                      key={instance.instanceId}
                      card={cardsById[instance.cardId] ?? null}
                      compact
                      onClick={() => setHandActionCardId(instance.instanceId)}
                      selected={handActionCardId === instance.instanceId}
                    />
                  ))}
                </div>
              </ZoneView>
              {renderShields(gameState.activePlayerId)}
              {renderManaZone(gameState.activePlayerId)}
              {renderBattleZone(gameState.activePlayerId)}
              <ZoneView
                title="Graveyard"
                count={activePlayer.graveyard.length}
                onInspect={() => setInspector({ playerId: gameState.activePlayerId, zone: "graveyard" })}
              />
            </div>
          </section>
        </div>
      </section>

      <aside className="panel side-panel">
        <h3>Card Detail</h3>
        {detailCard ? (
          <CardView card={detailCard} />
        ) : (
          <p className="muted">Select a card to inspect its details.</p>
        )}
        <LogPanel entries={gameState.log} />
      </aside>

      <Modal title="Card Actions" open={!!handCardDefinition} onClose={() => setHandActionCardId(null)}>
        {handCardDefinition && handCardInstance ? (
          <div className="column gap">
            <CardView card={handCardDefinition} />
            <div className="row wrap gap">
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "CHARGE_MANA", handInstanceId: handCardInstance.instanceId });
                  setHandActionCardId(null);
                }}
                disabled={gameState.phase !== "MANA" || gameState.chargedManaThisTurn || !!gameState.pendingPrompt}
              >
                Charge to Mana
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "REQUEST_PLAY_CARD", handInstanceId: handCardInstance.instanceId });
                  setHandActionCardId(null);
                }}
                disabled={gameState.phase !== "MAIN" || !!gameState.pendingPrompt}
              >
                Cast / Summon
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
        cardIndex={cardsById}
        onToggleMana={(instanceId) => dispatch({ type: "TOGGLE_MANA_SELECTION", manaInstanceId: instanceId })}
        onConfirm={() => dispatch({ type: "CONFIRM_MANA_PAYMENT" })}
        onCancel={() => dispatch({ type: "CANCEL_MANA_PAYMENT" })}
      />

      <Modal title="Choose Blocker" open={!!blockerPrompt}>
        <p>{blockerPrompt ? `${gameState.players[blockerPrompt.defenderId].name}, choose a blocker or decline.` : ""}</p>
        <div className="column gap">
          {blockerChoices.map((blocker) => {
            const card = cardsById[blocker.cardId] ?? null;
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
            <CardView card={triggerCard} />
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

      <Modal title="Zone Inspector" open={!!inspector} onClose={() => setInspector(null)}>
        {inspector ? (
          <div className="column gap">
            <p>
              {gameState.players[inspector.playerId].name} - {inspector.zone}
            </p>
            <div className="card-row">
              {inspectedCards.map(({ instance, card }) => {
                const hidden = inspector.zone === "shields";
                return (
                  <CardView
                    key={instance.instanceId}
                    card={card}
                    instance={instance}
                    hidden={hidden}
                    compact
                    onClick={() => setDetailCardId(instance.cardId)}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
