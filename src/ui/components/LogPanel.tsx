interface LogPanelProps {
  entries: string[];
}

export function LogPanel({ entries }: LogPanelProps) {
  return (
    <section className="log-panel">
      <header>
        <h3>Action Log</h3>
      </header>
      <ol>
        {[...entries].reverse().map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
