import type { ReactNode } from "react";

interface ZoneViewProps {
  title: string;
  count: number;
  onInspect?: () => void;
  children?: ReactNode;
}

export function ZoneView({ title, count, onInspect, children }: ZoneViewProps) {
  return (
    <section className="zone-view">
      <header className="zone-header">
        <h4>{title}</h4>
        <div className="zone-tools">
          <span className="pill">{count}</span>
          {onInspect ? (
            <button type="button" onClick={onInspect}>
              Inspect
            </button>
          ) : null}
        </div>
      </header>
      <div className="zone-content">{children}</div>
    </section>
  );
}
