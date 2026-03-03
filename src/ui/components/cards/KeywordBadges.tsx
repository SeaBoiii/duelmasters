import { memo, useMemo } from "react";
import type { CardDefinition } from "../../../data/types";

interface BadgeEntry {
  id: string;
  label: string;
}

function extractBadges(card: CardDefinition): BadgeEntry[] {
  const badges: BadgeEntry[] = [];
  const flags = card.keywords;
  if (flags.shieldTrigger) {
    badges.push({ id: "shield-trigger", label: "Shield Trigger" });
  }
  if (flags.blocker) {
    badges.push({ id: "blocker", label: "Blocker" });
  }
  if (flags.doubleBreaker) {
    badges.push({ id: "double-breaker", label: "Double Breaker" });
  }
  if (flags.tripleBreaker) {
    badges.push({ id: "triple-breaker", label: "Triple Breaker" });
  }
  if (flags.slayer) {
    badges.push({ id: "slayer", label: "Slayer" });
  }
  if (flags.charger) {
    badges.push({ id: "charger", label: "Charger" });
  }
  if (flags.powerAttackerBonus > 0) {
    badges.push({ id: "power-attacker", label: `Power Attacker +${flags.powerAttackerBonus}` });
  }
  return badges;
}

export interface KeywordBadgesProps {
  card: CardDefinition;
}

function KeywordBadgesComponent({ card }: KeywordBadgesProps) {
  const badges = useMemo(() => extractBadges(card), [card]);
  if (badges.length === 0) {
    return null;
  }
  return (
    <div className="dm-keyword-badges" aria-label="Card keywords">
      {badges.map((badge) => (
        <span key={badge.id} className="dm-keyword-badge">
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export const KeywordBadges = memo(KeywordBadgesComponent);
