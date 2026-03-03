import type { GameAction, GameState } from "../../engine/types";

interface DebugPanelProps {
  enabled: boolean;
  game: GameState | null;
  lastAction: GameAction | null;
}

export function DebugPanel({ enabled, game, lastAction }: DebugPanelProps) {
  if (!enabled) {
    return null;
  }
  return (
    <section className="panel debug-panel">
      <header className="row wrap gap">
        <h3>Debug Panel</h3>
        <span className="pill">debug=1</span>
      </header>
      {game ? (
        <>
          <p>
            Phase: <strong>{game.phase}</strong> | Active: <strong>{game.activePlayerId}</strong> | Turn:{" "}
            <strong>{game.turnNumber}</strong>
          </p>
          <p>
            Pending Prompt: <strong>{game.pendingPrompt?.type ?? "none"}</strong> | Trigger Queue:{" "}
            <strong>{game.pendingTriggers.length}</strong>
          </p>
          <p>
            Pending Payment: <strong>{game.pendingPayment ? `${game.pendingPayment.actionType} ${game.pendingPayment.selectedManaInstanceIds.length} mana selected` : "none"}</strong>
          </p>
          <p>
            Last Action: <code>{lastAction?.type ?? "none"}</code>
          </p>
          <h4>Last 10 Logs</h4>
          <ol>
            {game.log.slice(-10).map((entry, idx) => (
              <li key={`${entry}-${idx}`}>{entry}</li>
            ))}
          </ol>
        </>
      ) : (
        <p>No active duel.</p>
      )}
    </section>
  );
}
