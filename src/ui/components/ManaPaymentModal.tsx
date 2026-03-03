import type { CardDefinition } from "../../data/types";
import { canPayManaRequirement } from "../../engine/rules";
import type { PendingManaPayment, PlayerState } from "../../engine/types";
import { CivPips } from "./cards/CivPips";
import { Modal } from "./Modal";

interface ManaPaymentModalProps {
  open: boolean;
  prompt: PendingManaPayment | null;
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
  const pendingCard = player.hand.find((card) => card.instanceId === prompt.cardInstanceId);
  const pendingDef = pendingCard ? cardIndex[pendingCard.cardId] : null;
  const selected = new Set(prompt.selectedManaInstanceIds);
  const manaCards = player.mana.filter((mana) => !mana.tapped);
  const allManaDefs = player.mana.map((mana) => cardIndex[mana.cardId]).filter((entry): entry is CardDefinition => !!entry);
  const requirement = pendingDef ? canPayManaRequirement(pendingDef, allManaDefs, manaCards.length) : { ok: false, reason: "Card data missing." };
  const selectedCount = prompt.selectedManaInstanceIds.length;
  const selectedEnough = pendingDef ? selectedCount >= pendingDef.cost : false;
  const canConfirm = !!pendingDef && requirement.ok && selectedEnough;
  const reason = !pendingDef
    ? "Missing card definition."
    : !requirement.ok
      ? requirement.reason ?? "Mana requirements not met."
      : !selectedEnough
        ? `Select at least ${pendingDef.cost} mana.`
        : null;
  return (
    <Modal title="Pay Mana" open={open} onClose={onCancel}>
      <p>
        {pendingDef ? `Play ${pendingDef.name} (Cost ${pendingDef.cost})` : "Play selected card"}
      </p>
      <p>
        Selected: {prompt.selectedManaInstanceIds.length}
        {pendingDef ? ` / ${pendingDef.cost}` : ""}
      </p>
      {reason ? <p className="error-banner">{reason}</p> : <p className="status">Mana payment is valid.</p>}
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
              <span>{card ? card.name : "Unknown"}</span>
              <CivPips civilizations={card?.civilizations ?? []} />
            </button>
          );
        })}
      </div>
      <div className="row gap">
        <button type="button" onClick={onConfirm} disabled={!canConfirm}>
          Confirm
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
