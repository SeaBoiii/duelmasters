export function SettingsAbout() {
  return (
    <section className="panel">
      <h2>Settings & About</h2>
      <p>
        This project is a fan-made browser game inspired by Duel Masters mechanics and intended for personal/educational use.
      </p>
      <p>
        Card data source: <code>Latepate64/duel-masters-json</code> fetched at runtime and cached locally in IndexedDB.
      </p>
      <p>No official art is bundled. Cards are rendered as text-based UI cards only.</p>
      <h3>Local Data</h3>
      <ul>
        <li>Decks are stored in IndexedDB and stay on your browser/device.</li>
        <li>Card database cache is reused on next load, then refreshed in background.</li>
      </ul>
      <h3>Accessibility</h3>
      <ul>
        <li>All game interactions are clickable buttons.</li>
        <li>Focus-visible styles are included for keyboard navigation.</li>
      </ul>
    </section>
  );
}
