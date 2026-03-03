import { memo } from "react";

const CIV_SHORT: Record<string, string> = {
  fire: "F",
  water: "W",
  nature: "N",
  light: "L",
  darkness: "D"
};

function normalizeCivilization(value: string): string {
  return value.trim().toLowerCase();
}

export interface CivPipsProps {
  civilizations: string[];
}

function CivPipsComponent({ civilizations }: CivPipsProps) {
  if (civilizations.length === 0) {
    return <span className="dm-empty-pill">No Civ</span>;
  }
  return (
    <div className="dm-civ-pips" aria-label={`Civilizations: ${civilizations.join(", ")}`}>
      {civilizations.map((civilization) => {
        const normalized = normalizeCivilization(civilization);
        return (
          <span key={`${normalized}-${civilization}`} className={`dm-civ-pip dm-civ-${normalized}`} title={civilization}>
            {CIV_SHORT[normalized] ?? civilization[0]?.toUpperCase() ?? "?"}
          </span>
        );
      })}
    </div>
  );
}

export const CivPips = memo(CivPipsComponent);
