# ASCII PORTAL — Deferred / TODO notes

## Enter-name screen (DONE)

Implemented in `game.js`. A one-time registration screen appears between the
title and Chamber 01: the title's "press any key / click" now calls
`showNameEntry()` (mode `"name"`) instead of jumping straight into the game.

- `handleNameKey()` captures letters/digits/spaces, `Backspace` erases,
  `Escape` clears, `Enter` (`confirmName()`) locks it in and starts Chamber 01.
- Capped at `NAME_MAX` (12 chars).
- Persisted to localStorage key `asciiPortalPlayerName` and restored at boot to
  pre-fill the field; stored on `state.playerName`.
- Rendering goes through `boxed()` + `showOverlay()` (which uses `textContent`,
  so no HTML-injection risk); the field repaints each frame for a blinking caret.
- Shown on the victory screen in `winGame()` ("CONGRATULATIONS, <NAME>!"),
  falling back to "AGENT" when left blank.
