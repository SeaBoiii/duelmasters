import type { ReactNode } from "react";
import type { CardDefinition } from "../../../data/types";
import type { CardInstance } from "../../../engine/types";
import { formatPower } from "../../../engine/rules";
import { CivPips } from "./CivPips";
import { KeywordBadges } from "./KeywordBadges";
import "./cardStyles.css";

export type CardVariant = "mini" | "full";

export interface CardFrameProps {
  card: CardDefinition | null;
  instance?: CardInstance;
  hidden?: boolean;
  selected?: boolean;
  variant: CardVariant;
  footerRight?: ReactNode;
}

function normalizeCivilization(civilization: string): string {
  return civilization.trim().toLowerCase();
}

function makeThemeStyle(card: CardDefinition | null): Record<string, string> {
  if (!card || card.civilizations.length === 0) {
    return {
      "--dm-primary": "#737373",
      "--dm-secondary": "#a3a3a3",
      "--dm-tertiary": "#e5e5e5"
    } as Record<string, string>;
  }
  const palette: Record<string, [string, string, string]> = {
    fire: ["#de511e", "#a83015", "#f7ab74"],
    water: ["#1f6fbe", "#144b8b", "#89c9f7"],
    nature: ["#2f8e44", "#20632f", "#9ad8a3"],
    light: ["#c59c1a", "#896500", "#f9de7b"],
    darkness: ["#4c2a72", "#29163f", "#a88ed2"]
  };
  const entries = card.civilizations.map(normalizeCivilization);
  if (entries.length === 1) {
    const [primary, secondary, tertiary] = palette[entries[0]] ?? palette.darkness;
    return {
      "--dm-primary": primary,
      "--dm-secondary": secondary,
      "--dm-tertiary": tertiary
    } as Record<string, string>;
  }
  const first = palette[entries[0]] ?? palette.darkness;
  const second = palette[entries[1]] ?? first;
  return {
    "--dm-primary": first[0],
    "--dm-secondary": second[0],
    "--dm-tertiary": first[2]
  } as Record<string, string>;
}

function summarizeTypeLine(card: CardDefinition): string {
  const type = card.type.toUpperCase();
  if (card.subtypes.length > 0 || card.supertypes.length > 0) {
    const suffix = [...card.supertypes, ...card.subtypes].join(" / ");
    return `${type} / ${suffix}`;
  }
  return type;
}

const HIGHLIGHT_REGEX = /(Shield Trigger|Blocker|Double Breaker|Triple Breaker|Slayer|Charger|Power attacker \+\d+)/gi;

function highlightKeywords(line: string): ReactNode {
  const chunks = line.split(HIGHLIGHT_REGEX);
  return chunks.map((chunk, index) => {
    if (chunk.match(HIGHLIGHT_REGEX)) {
      return (
        <mark key={`${chunk}-${index}`} className="dm-keyword-mark">
          {chunk}
        </mark>
      );
    }
    return <span key={`${chunk}-${index}`}>{chunk}</span>;
  });
}

function renderTextLines(text: string): ReactNode {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return <p className="dm-empty-text">No effect text.</p>;
  }
  return (
    <div className="dm-text-lines">
      {lines.map((line, index) => {
        const isBullet = /^[-*]/.test(line);
        const normalized = line.replace(/^[-*]\s*/, "");
        return (
          <p key={`${line}-${index}`} className={isBullet ? "dm-bullet-line" : ""}>
            {isBullet ? <span className="dm-bullet-glyph">*</span> : null}
            <span>{highlightKeywords(normalized)}</span>
          </p>
        );
      })}
    </div>
  );
}

function renderArtWell(variant: CardVariant): ReactNode {
  return (
    <div className={`dm-art-well ${variant}`}>
      <span>ART AREA</span>
    </div>
  );
}

export function CardFrame({ card, instance, hidden = false, selected = false, variant, footerRight }: CardFrameProps) {
  const className = [
    "dm-card-frame",
    variant === "mini" ? "dm-mini" : "dm-full",
    hidden ? "dm-hidden" : "",
    selected ? "dm-selected" : "",
    instance?.tapped ? "dm-tapped" : "",
    instance?.summoningSickness ? "dm-sick" : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (hidden) {
    return (
      <article className={className}>
        <img src={`${import.meta.env.BASE_URL}card-back.svg`} alt="Face-down shield" className="dm-card-back" />
      </article>
    );
  }

  if (!card) {
    return (
      <article className={className} style={makeThemeStyle(null)}>
        <header className="dm-card-header">
          <span className="dm-cost">?</span>
          <div className="dm-title-wrap">
            <strong>Missing Card Data</strong>
            <small>UNKNOWN</small>
          </div>
        </header>
        {renderArtWell(variant)}
        <section className="dm-body-box">
          <p className="dm-empty-text">Card definition could not be loaded.</p>
        </section>
        <footer className="dm-card-footer">
          <strong className="dm-power">-</strong>
          <span className="dm-empty-pill">No Civ</span>
          <small>n/a</small>
        </footer>
      </article>
    );
  }

  const printInfo = card.primaryPrinting ? `${card.primaryPrinting.set} ${card.primaryPrinting.id}` : "Set ?";
  return (
    <article className={className} style={makeThemeStyle(card)} aria-label={card.name}>
      <header className="dm-card-header">
        <span className="dm-cost" aria-label={`Cost ${card.cost}`}>
          {card.cost}
        </span>
        <div className="dm-title-wrap">
          <strong>{card.name}</strong>
          <small>{summarizeTypeLine(card)}</small>
        </div>
      </header>

      {renderArtWell(variant)}

      <section className="dm-body-box">
        <KeywordBadges card={card} />
        {variant === "full" ? renderTextLines(card.text) : <p className="dm-mini-snippet">{card.text.split("\n")[0] ?? "No text"}</p>}
      </section>

      <footer className="dm-card-footer">
        <strong className="dm-power">{formatPower(card.powerBase, card.powerHasPlus)}</strong>
        <CivPips civilizations={card.civilizations} />
        {footerRight ?? <small>{printInfo}</small>}
      </footer>

      {instance?.summoningSickness ? <span className="dm-state-chip">Sick</span> : null}
      {instance?.tapped ? <span className="dm-state-chip tapped">Tapped</span> : null}
    </article>
  );
}
