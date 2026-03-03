import { memo } from "react";
import type { CardDefinition } from "../../../data/types";
import type { CardInstance } from "../../../engine/types";
import { CardFrame } from "./CardFrame";

export interface CardMiniProps {
  card: CardDefinition | null;
  instance?: CardInstance;
  hidden?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function CardMiniComponent({ card, instance, hidden = false, selected = false, onClick }: CardMiniProps) {
  return (
    <button
      type="button"
      className="dm-card-button"
      onClick={onClick}
      aria-label={card ? `View ${card.name}` : "View card"}
      disabled={!onClick}
    >
      <CardFrame card={card} instance={instance} hidden={hidden} selected={selected} variant="mini" />
    </button>
  );
}

export const CardMini = memo(CardMiniComponent);
