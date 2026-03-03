import type { CardDefinition } from "../../../data/types";
import type { CardInstance } from "../../../engine/types";
import { CardFrame } from "./CardFrame";

export interface CardFullProps {
  card: CardDefinition | null;
  instance?: CardInstance;
  hidden?: boolean;
  selected?: boolean;
}

export function CardFull({ card, instance, hidden = false, selected = false }: CardFullProps) {
  return (
    <div className="dm-full-wrap">
      <CardFrame card={card} instance={instance} hidden={hidden} selected={selected} variant="full" />
      {card && card.printings.length > 0 ? (
        <section className="dm-printings" aria-label="Printings">
          <h4>Printings</h4>
          <ul>
            {card.printings.slice(0, 6).map((printing) => (
              <li key={`${printing.set}-${printing.id}`}>
                {printing.set} #{printing.id} ({printing.rarity})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
