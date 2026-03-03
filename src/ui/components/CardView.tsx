import type { CardDefinition } from "../../data/types";
import type { CardInstance } from "../../engine/types";

interface CardViewProps {
  card: CardDefinition | null;
  instance?: CardInstance;
  hidden?: boolean;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function renderCivilizations(card: CardDefinition): string {
  return card.civilizations.join(" / ");
}

export function CardView({ card, instance, hidden = false, compact = false, selected = false, onClick }: CardViewProps) {
  const className = [
    "card-view",
    compact ? "compact" : "",
    selected ? "selected" : "",
    instance?.tapped ? "tapped" : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (hidden) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <img src={`${import.meta.env.BASE_URL}card-back.svg`} alt="Face-down card" className="card-back-art" />
      </button>
    );
  }

  if (!card) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <span>Unknown card</span>
      </button>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      <div className="card-head">
        <strong>{card.name}</strong>
        <span className="pill">Cost {card.cost}</span>
      </div>
      <div className="card-meta">
        <span>{card.type}</span>
        <span>{renderCivilizations(card)}</span>
      </div>
      {card.powerBase !== null ? (
        <div className="card-power">
          Power {card.powerBase}
          {card.powerHasPlus ? "+" : ""}
        </div>
      ) : null}
      {!compact ? <p className="card-text">{card.text}</p> : null}
      {instance ? (
        <div className="card-flags">
          {instance.summoningSickness ? <span className="pill warn">Summoning Sickness</span> : null}
          {instance.tapped ? <span className="pill">Tapped</span> : <span className="pill good">Untapped</span>}
        </div>
      ) : null}
    </button>
  );
}
