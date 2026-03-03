# Duel Masters Hotseat (Vite + React + TypeScript)

Browser-only, hotseat 2-player card game inspired by Duel Masters mechanics.

## Features
- Reducer-based duel engine (pure state transitions in `src/engine`)
- Runtime card DB fetch from `Latepate64/duel-masters-json`
- IndexedDB cache (stale-while-revalidate)
- Deck builder with local saved decks and starter deck generation
- Duel boot guards for loading/invalid deck/runtime error states
- Duel Masters-inspired card UI (`CardMini` and `CardFull`)
- Deck builder hover/tap card preview popover
- GitHub Pages deploy workflow

## Changelog (Recent)
- Unified card sizing with shared `CardFrame` dimensions via CSS variables and fixed aspect ratio.
- Replaced `/gallery` route with Deck Builder hover/tap CardFull preview.
- Upgraded duel board layout: opponent top, player bottom, compact mana tiles, phase control side panel.
- Added explicit phase controls: `Next Phase` and `End Turn` (`End Turn` only in `END`).
- Implemented manual mana payment selection using reducer `pendingPayment`.
- Added strict deck-out loss rule when a draw makes deck size 0.
- Preserved direct-attack loss when defender has 0 shields.
- Expanded Vitest coverage for phase flow, mana payment, deck-out, and direct attack loss.

## How To Run
1. Install:
   ```bash
   npm ci
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Build:
   ```bash
   npm run build
   npm run preview
   ```

## Project Structure
```text
.
|- .github/workflows/deploy.yml
|- public/
|  |- card-back.svg
|  `- sword.svg
|- src/
|  |- App.tsx
|  |- main.tsx
|  |- router.tsx
|  |- styles.css
|  |- data/
|  |  |- cardSource.ts
|  |  |- deckStore.ts
|  |  `- types.ts
|  |- engine/
|  |  |- reducer.ts
|  |  |- rules.ts
|  |  |- selectors.ts
|  |  `- types.ts
|  `- ui/
|     |- DeckBuilder.tsx
|     |- DuelBoard.tsx
|     |- DuelErrorBoundary.tsx
|     |- SettingsAbout.tsx
|     `- components/
|        |- DebugPanel.tsx
|        |- LogPanel.tsx
|        |- ManaPaymentModal.tsx
|        |- Modal.tsx
|        |- ZoneView.tsx
|        `- cards/
|           |- CardFrame.tsx
|           |- CardMini.tsx
|           |- CardFull.tsx
|           |- CivPips.tsx
|           |- KeywordBadges.tsx
|           `- cardStyles.css
`- test/engine.test.ts
```

## How to Play
1. Go to `Deck Builder` and create/select two legal decks (40+ cards, max 4 copies by name).
2. Open `Duel`, choose each player deck, and start the match.
3. Use hand actions:
   - `Charge to Mana` during `MANA`
   - `Cast / Summon` during `MAIN`
4. In `MAIN`, casting/summoning opens `Pay Mana`; select mana tiles manually, then confirm.
5. In `BATTLE`, attack with eligible creatures and choose targets.
6. Win by direct attack when opponent has 0 shields, or via deck-out rules.

## Phase Controls
- The right panel always shows `CURRENT PHASE` and active player.
- `Advance` is the single phase control action.
- `Advance` auto-runs passive phases (`UNTAP`, `DRAW`) and pauses at decision phases (`MANA`, `MAIN`, `BATTLE`).
- At `END`, `Advance` passes turn to the opponent and auto-runs their `UNTAP`/`DRAW`.
- Invalid action attempts show a short toast message and are not applied.

## Card Database
- Source URL:
  - `https://raw.githubusercontent.com/Latepate64/duel-masters-json/master/DuelMastersCards.json`
- The full JSON is not committed in this repo.
- `src/data/cardSource.ts`:
  - loads from IndexedDB cache first
  - revalidates in background
  - normalizes into internal `CardDefinition`
  - fixes common mojibake patterns
  - normalizes newlines to `\n`

## Duel Rules Implemented (MVP)
- Setup: 5 shields + draw 5 for both players
- First player skips untap and draw on turn 1
- Phases: Untap -> Draw -> Mana -> Main -> Battle -> End
- Mana charging and mana payment with civilization requirements
- Summoning sickness for newly summoned creatures
- Attacks: player or tapped creature
- Blocker selection
- Slayer, Double Breaker, Triple Breaker, Charger, Power Attacker
- Shield Trigger prompt flow
- Lose when a draw makes your deck size 0 (strict rule) or by attempting to draw from empty deck
- Lose on direct attack if you have 0 shields

## Debugging
- Add `?debug=1` to URL to show duel debug panel.
- Debug panel shows:
  - active player
  - phase
  - pending prompt/trigger queue
  - last dispatched action
  - last 10 log entries

## Troubleshooting Duel Issues
- Duel start button disabled:
  - Verify both players selected a deck.
  - Verify each selected deck has at least 40 valid card definitions.
  - Go to Deck Builder and re-save/rebuild old decks if the card DB changed.
- Duel screen shows loading:
  - Card DB may still be loading. Wait for progress text.
  - Use `Retry Card Load` if fetch failed.
- Card appears as "Missing Card Data":
  - Deck references a card ID not present in current normalized DB.
  - Rebuild the deck in Deck Builder.
- Unexpected duel crash:
  - `DuelErrorBoundary` provides `Reset Duel` and `Back to Deck Builder`.
  - Check browser console plus reducer/action flow:
    - `src/ui/DuelBoard.tsx`
    - `src/engine/reducer.ts`
    - `src/engine/rules.ts`

## GitHub Pages
- Workflow: `.github/workflows/deploy.yml`
- Set repository Pages source to GitHub Actions.
- Push to `main` to deploy.

### Base Path
- `vite.config.ts` uses `VITE_BASE_PATH` if set.
- Default base path is `/duelmasters/`.
- Workflow sets:
  - `VITE_BASE_PATH=/${{ github.event.repository.name }}/`

## Disclaimer
- Fan-made project inspired by Duel Masters.
- No copyrighted card art is bundled.
- Data is loaded from the referenced JSON repository for personal/educational use.
