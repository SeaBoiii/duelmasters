# Duel Masters Hotseat (Vite + React + TypeScript)

Browser-only, hotseat 2-player card game inspired by Duel Masters.  
Includes:
- Playable duel loop with shields, mana, battle, and win/loss conditions
- Runtime card DB loading from `Latepate64/duel-masters-json`
- Deck builder with filtering and validation
- IndexedDB caching for card data + saved decks
- GitHub Pages deployment workflow

## Tech Stack
- Vite
- React + TypeScript (strict mode)
- Vitest (rule/reducer tests)
- IndexedDB via `idb-keyval`

## Project Structure
```text
.
├─ .github/workflows/deploy.yml
├─ public/
│  ├─ card-back.svg
│  └─ sword.svg
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ router.tsx
│  ├─ styles.css
│  ├─ data/
│  │  ├─ cardSource.ts
│  │  ├─ deckStore.ts
│  │  └─ types.ts
│  ├─ engine/
│  │  ├─ reducer.ts
│  │  ├─ rules.ts
│  │  ├─ selectors.ts
│  │  └─ types.ts
│  └─ ui/
│     ├─ DeckBuilder.tsx
│     ├─ DuelBoard.tsx
│     ├─ SettingsAbout.tsx
│     └─ components/
│        ├─ CardView.tsx
│        ├─ LogPanel.tsx
│        ├─ ManaPaymentModal.tsx
│        ├─ Modal.tsx
│        └─ ZoneView.tsx
└─ test/
   └─ engine.test.ts
```

## How To Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Production build:
   ```bash
   npm run build
   npm run preview
   ```

## Gameplay Rules Implemented (MVP)
- Zones: deck, hand, mana, battle, graveyard, shields
- Setup: each player sets top 5 cards as shields, then draws 5
- Starting player skips untap and draw on turn 1
- Turn phases: Untap -> Draw -> Mana -> Main -> Battle -> End
- Mana charge: optional once/turn, 1 hand card to mana tapped
- Mana payment:
  - Requires enough untapped mana for cost
  - Requires civilization coverage in mana zone for each card civilization
- Summon/cast:
  - Creatures enter untapped with summoning sickness
  - Spells resolve with generic/no-op effect, then graveyard
  - `Charger`: spell goes to mana tapped instead of graveyard
- Combat:
  - Attacker must be untapped and not summoning sick
  - Attack player or tapped creature
  - Defender may assign one untapped `Blocker`
  - Battle by power, ties destroy both
  - `Slayer` destroys opposing creature after battle regardless of power
  - `Power attacker +N` applies while attacking
- Shields:
  - Default break 1
  - `Double breaker` / `Triple breaker` supported
  - Broken shields go to defender hand
  - `Shield trigger`: prompt to cast/summon for free immediately
  - Direct attack only wins when defender already has 0 shields
- Loss conditions:
  - Draw from empty deck
  - Directly attacked with 0 shields

## Card Database Loading + Caching
- Runtime fetch source:
  - `https://raw.githubusercontent.com/Latepate64/duel-masters-json/master/DuelMastersCards.json`
- Large JSON is **not** committed to this repo.
- `src/data/cardSource.ts`:
  - Reads cache from IndexedDB first
  - Returns cached cards immediately when available
  - Revalidates in background (stale-while-revalidate)
  - Normalizes dataset shape into internal `CardDefinition`
  - Applies best-effort mojibake fixes when telltale sequences appear (`Ã`, `â€”`, etc.)
  - Normalizes newlines to `\n`
- Parsed keyword flags are stored on each normalized card for fast gameplay checks.

## Deck Builder Notes
- Search/filter by:
  - name
  - civilization(s)
  - type
  - cost range
  - Creature/Spell kind
- Validation:
  - minimum 40 cards
  - maximum 4 copies by card name
- Decks persist locally in IndexedDB.
- “Generate Starters” creates mono-civilization 40-card starter decks from low-cost cards.

## GitHub Pages Deployment
Workflow: `.github/workflows/deploy.yml`

### One-time repository settings
1. In GitHub: `Settings -> Pages`
2. Source: `GitHub Actions`

### Deploy
- Push to `main` branch; workflow builds and deploys automatically.

## Base Path Configuration (Repo Subpath)
- `vite.config.ts` uses:
  - `process.env.VITE_BASE_PATH` if set
  - fallback: `/duelmasters/`
- GitHub Actions sets:
  - `VITE_BASE_PATH=/${{ github.event.repository.name }}/`
- For a different repository name or custom path, update:
  - workflow env var, or
  - your local `VITE_BASE_PATH` before running `npm run build`.

## Disclaimer
- Fan-made project inspired by Duel Masters.
- No copyrighted card art is included.
- Data comes from the referenced open JSON repository and is intended for personal/educational use.
