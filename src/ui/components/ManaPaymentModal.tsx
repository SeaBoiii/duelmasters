import type { CardDefinition } from "../../data/types";
import type { ManaPaymentPrompt, PlayerState } from "../../engine/types";
import { Modal } from "./Modal";

interface ManaPaymentModalProps {
  open: boolean;
  prompt: ManaPaymentPrompt | null;
  player: PlayerState | null;
  cardIndex: Record<string, CardDefinition>;
  onToggleMana: (instanceId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ManaPaymentModal({
  open,
  prompt,
  player,
  cardIndex,
  onToggleMana,
  onConfirm,
  onCancel
}: ManaPaymentModalProps) {
  if (!open || !prompt || !player) {
    return null;
  }
  const pendingCard = player.hand.find((card) => card.instanceId === prompt.handInstanceId);
  const pendingDef = pendingCard ? cardIndex[pendingCard.cardId] : null;
  const selected = new Set(prompt.selectedManaIds);
  const manaCards = player.mana.filter((mana) => !mana.tapped);
  return (
    <Modal title="Pay Mana" open={open} onClose={onCancel}>
      <p>
        {pendingDef ? `Play ${pendingDef.name} (Cost ${pendingDef.cost})` : "Play selected card"}
      </p>
      <p>
        Selected: {prompt.selectedManaIds.length}
        {pendingDef ? ` / ${pendingDef.cost}` : ""}
      </p>
      <div className="mana-grid">
        {manaCards.map((mana) => {
          const card = cardIndex[mana.cardId];
          const isSelected = selected.has(mana.instanceId);
          return (
            <button
              type="button"
              key={mana.instanceId}
              className={isSelected ? "selected" : ""}
              onClick={() => onToggleMana(mana.instanceId)}
            >
              {card ? card.name : "Unknown"} ({card?.civilizations.join("/") ?? "?"})
            </button>
          );
        })}
      </div>
      <div className="row gap">
        <button type="button" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
