# ASCII PORTAL — Deferred / TODO notes

## Enter-name screen (NOT YET IMPLEMENTED — placeholder)

Add an "enter your name" prompt somewhere in **Chamber 01** (the first level).
Decide the exact trigger later — likely candidates:

- On first entering Chamber 01, before the player can move, or
- A one-time modal on the very first `startGame()`.

Requirements when built:

- Capture a short player name (cap length, e.g. 12 chars; sanitize before
  rendering since output is injected as innerHTML — reuse `esc()` in game.js).
- Persist it (localStorage key, e.g. `asciiPortalPlayerName`, alongside the
  existing `asciiPortalMaxReached`) so it survives reloads.
- Store it on `state` (e.g. `state.playerName`).
- **Display it on the final congratulations screen** after the final boss
  (e.g. "CONGRATULATIONS, <NAME>!").

For now this is only a note — do not build the input flow yet.
