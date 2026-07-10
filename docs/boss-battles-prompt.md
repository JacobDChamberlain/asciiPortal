# Implementation Prompt — Boss Battles & Final Boss for ASCII PORTAL

> Paste this as the task prompt for the coding agent. It is grounded in the
> actual codebase (`game.js`, `levels.js`, `index.html`, `styles.css`).

---

## ROLE

You are a gameplay engineer working on **ASCII PORTAL**, a browser Portal
clone rendered entirely as a monospaced character grid. The whole game is
vanilla JS with **no build step and no dependencies** — three scripts load in
order from `index.html`: `levels.js`, then `game.js`, with `styles.css` for
colors. Match the existing code's style exactly: `"use strict"`, terse
single-file functions, ASCII-art sprites blitted onto a char buffer, and the
heavy explanatory comment blocks the file already uses. Do not introduce
frameworks, canvas, or a bundler.

## TASK

Add a boss-fight system on top of the existing 10-chamber puzzle campaign:

1. **Three "sweeper" bosses**, one triggered *after* clearing Chambers **3, 6,
   and 9**. Mechanics are Sonic-vs-Eggman style:
   - The boss robot sweeps horizontally across the arena (left→right, then
     back), at the player's height range.
   - The player damages it by **jumping and landing on top of it** (a stomp),
     exactly like stomping Goombas/Eggman. Any *side/bottom* contact instead
     hurts the player (restart the encounter, or lose the run — see OPEN
     QUESTIONS; default: restart the boss fight).
   - A successful stomp bounces the player back up and registers one hit.
   - Hits to kill scale with boss number: **Boss 1 = 3 hits, Boss 2 = 4 hits,
     Boss 3 = 5 hits.**
   - Each boss is a **distinct robot sprite, visibly bigger and more complex**
     than the last. Give each its own multi-row ASCII art and color class.
   - On death: brief victory beat, then continue into the next chamber via the
     existing flow.

2. **Final boss**, triggered *after* clearing **Chamber 10**:
   - Arena is a **massive, detailed mosaic room with animated flashing
     graphics** (use the frame counter `state.frame` to cycle colors/tiles).
   - Clearing Chamber 10 grants a **SWORD** as the reward (mirror how Chamber 1
     grants the portal gun). Once held, pressing **`h`** performs a sword
     strike at the boss.
   - The final boss is **massive** and has a **visible health bar**. It takes
     **10 hits** to kill.
   - On death: a **fun congratulations screen** (celebratory ASCII, uses the
     existing overlay). Leave a hook to display the player's name here — see
     `NOTES.md` (enter-name screen is deferred; just make the congrats screen
     ready to interpolate a name, defaulting to something like "AGENT").

3. Keep everything else working: puzzle chambers, portals, cube, water,
   progression/localStorage, and the chamber selector.

## CONTEXT — how the codebase works (read before writing)

**Files**
- `index.html` — DOM: `#screen` (the `<pre>` char grid), `#overlay` +
  `#overlayText` (fullscreen text overlays), and the right-side `#panel` HUD
  (chamber select, gun view, hud lines, controls, objective). Add any new HUD
  rows / control hints here.
- `levels.js` — `LEVELS` array built by `mk(name, gun, hint, interiorRows)`.
  Rows are authored small and blown up by `SCALE`. Tile legend in the header
  comment. Boss arenas do **not** have to be `LEVELS` entries — prefer separate
  boss definitions so they don't appear in the chamber `<select>`.
- `game.js` — everything else. Key pieces:

**State & modes** — `state.mode` is one of `"start" | "play" | "loading" |
"reward" | "won"`. The main loop (`frame()`) switches on it. **Add new modes**
(e.g. `"boss"`, `"bossWin"`, `"finalBoss"`) rather than overloading `"play"`,
so puzzle physics and boss physics stay separate. `state` also holds
`levelIndex`, `player`, `cube`, `hasGun`, `frame`, `maxReached`, overlay/flash
timers. You'll add fields like `state.hasSword`, `state.boss`, `state.bossHits`.

**Coordinates & physics** — 1 char cell = 1 unit; `+x` right, `+y` **down**.
`SCALE = 2` blows up the world; velocities/gravity scale with it. Bodies come
from `makeBody(x,y,w,h)` and move via `moveBody(b, dt)` which does gravity,
axis-separated AABB collision against solid tiles, trampolines, portals, and
friction. `p.onGround` and `p.vy` tell you the player's fall state — a stomp is
"`player.vy > 0` (falling) AND player's box overlaps the boss's top band."
Reuse AABB overlap the way `step()` already tests door cells:
`p.x < b.x+b.w && p.x+p.w > b.x && p.y < b.y+b.h && p.y+p.h > b.y`.

**Rendering** — each frame: `resetBuffer()` → `drawWorld()` → `drawDoor()` →
`drawPortals()` → `drawCube()` → `drawPlayer()` → compose. Draw sprites with
`blit(x, y, rows, cls)` (skips spaces) and single cells with `put(x, y, ch,
cls)`. Every glyph carries a **class token** `cls`; the composer emits
`<span class="t-<cls>">`. So a new color = add a `.t-foo` rule in `styles.css`
(see the existing `--pa`, `--water`, `--player` vars and `.t-*` rules). Flashing
= pick the char/class from `state.frame` (see how `~` water and `^` trampoline
already animate with `Math.floor(f/6)`).

**Game flow** — `completeLevel()` decides what happens when a chamber is
finished: Chamber 1 → grant gun + `reward` overlay; last chamber → `won`;
otherwise → short `loading` overlay then `advance()` (`loadLevel(index+1)`).
**This is the hook point**: after finishing Chamber 3/6/9, route into a boss
fight instead of straight to `advance()`; after Chamber 10, route into the
final boss. `showOverlay(text)`/`hideOverlay()`, `boxed(lines, chars)`, and
`centerLines(lines)` build the text screens. Progression persists via
`state.maxReached` + `localStorage["asciiPortalMaxReached"]`; persist the sword
similarly if you want it to survive reload.

**Input** — `keydown`/`keyup` fill `keys{}`; letters are handled in the
`keydown` listener while `state.mode === "play"` (e.g. `q`/`f` fire portals,
`e` grab, `t` throw, `r` restart). Add `h` for the sword strike, gated on
`state.hasSword` and the appropriate boss mode. Movement/jump read in `step()`.

**Main loop** — `frame(now)` computes `dt`, updates aim, and steps physics only
while `mode === "play"`; `loading`/`reward` just tick `overlayTimer`. Add a
`stepBoss(dt)` branch for the boss modes and call `render()` (bosses reuse the
same renderer) plus a boss-specific draw pass.

## IMPLEMENTATION PLAN (suggested, not rigid)

1. **Boss data.** Define a `BOSSES` array (parallel to `LEVELS`): each entry
   has `{ arenaRows, sprite (row strings), spriteCls, hitsToKill, sweepSpeed,
   yBand, name }`. Author arena rows with the same tile legend; build the grid
   the same way `loadLevel` does (factor out a small grid-builder if helpful).
2. **`enterBoss(n)`** — load the boss arena, spawn the player at a safe start,
   create `state.boss = makeBody(...)` with `hp = hitsToKill`, set
   `state.mode = "boss"`, update HUD (show a hit counter / health).
3. **`stepBoss(dt)`** — move the player with normal controls (`getHorizontalMove`,
   jump), sweep the boss (`boss.x += dir * speed * dt`, flip `dir` at walls),
   then resolve player↔boss contact:
   - stomp (player falling + overlapping top band) → `boss.hp--`, bounce player
     (`p.vy = -JUMP_VEL`), i-frames on the boss for a beat; if `hp <= 0` →
     `state.mode = "bossWin"` → after a short overlay, `advance()`/next chamber.
   - other contact → hurt player → re-enter the boss (or restart run).
4. **`drawBoss()`** — `blit` the boss sprite each frame; flash on hit; for the
   final boss also draw the animated mosaic backdrop and the **health bar**
   (a row of cells whose fill = `hp/maxHp`, colored via a `.t-bossbar` class).
5. **Sword.** On Chamber 10 completion, `state.hasSword = true` + reward
   overlay. In the final-boss mode, `h` triggers a strike: if the player is
   within reach of the boss, `boss.hp--` with a swing animation + flash.
   (Decide whether the final boss is stomp-immune and sword-only, or both — see
   OPEN QUESTIONS. Default: final boss is **sword-only**, 10 hits.)
6. **Congrats screen.** `state.mode = "won"` (or a new `"beaten"`) with a
   celebratory `boxed`/`centerLines` overlay. Interpolate `state.playerName ||
   "AGENT"`.
7. **Wire HUD & controls** in `index.html` (add the `h` = sword hint, a boss
   HP line) and colors in `styles.css`.

## EXAMPLES (patterns to copy from the existing code)

**A multi-row sprite drawn feet/pos-anchored (from `drawCube`)**
```js
blit(x, y, ["┌───┐",
            "│▓▓▓│",
            "│▓ ▓│",
            "│▓▓▓│",
            "└───┘"], "cube");
```
Do the same for each boss, e.g. a bigger Boss 1:
```js
const BOSS1 = [
  "  ╔══════╗  ",
  " ╔╝ ◉  ◉ ╚╗ ",
  " ║  ▂▂▂▂  ║ ",
  " ╚╗ ████ ╔╝ ",
  "  ╚═╗  ╔═╝  ",
  "   ▟█▙▟█▙   ",
];
blit(bx, by, BOSS1, "boss1");
```

**Animating a tile/color off the frame counter (from `drawWorld`, water)**
```js
const w = "≈~≈-‗~";
chars[y][x] = w[(x + Math.floor(f / 6)) % w.length];
cls[y][x] = "water";
```
Use this pattern for the final-boss mosaic flashing (cycle among several
`.t-mosaicA/B/C` classes by `Math.floor(f/4) % 3`).

**AABB overlap test (from `step`, door-cell win check)**
```js
if (p.x < d.x + 1 && p.x + p.w > d.x && p.y < d.y + 1 && p.y + p.h > d.y) { ... }
```
Stomp = that overlap **plus** `p.vy > 0` **plus** the player's feet are in the
boss's top band (`p.y + p.h <= boss.y + TOPBAND`).

**A reward overlay + mode flip (from `completeLevel`, gun grant)** — copy this
shape for the sword:
```js
state.hasSword = true;
state.mode = "reward";
state.overlayTimer = 3.0;
showOverlay(["", ""].concat(boxed([
  "PORTAL BLADE  ACQUIRED",
  "",
  "   ▟█████▙",
  "   ══╪══════════▶",
  "   ▜█████▛",
  "",
  "Press  H  to strike the core.",
])).join("\n"));
```

**Adding a keybind (from the `keydown` listener)**
```js
if (k === "h") swordStrike();   // only acts when state.hasSword && final-boss mode
```

**A new color** — in `styles.css`, next to the other `.t-*` rules:
```css
:root{ --boss1:#ff5a5a; --bossbar:#ff2d5a; --mosaicA:#ff3cf0; }
.t-boss1{ color:var(--boss1); text-shadow:0 0 8px var(--boss1); }
.t-bossbar{ color:var(--bossbar); text-shadow:0 0 8px var(--bossbar); }
```

## CONSTRAINTS

- No new dependencies, no build tooling, no canvas — stay on the char grid.
- Don't break puzzle chambers, portal physics, or the chamber selector.
- Boss arenas should **not** pollute the chamber `<select>` (keep them out of
  `LEVELS`, or filter them out of `syncChamberOptions`).
- Any string that reaches `innerHTML` must go through `esc()` (already used by
  the renderer) — never interpolate a raw player name.
- Keep comments in the established voice; explain non-obvious mechanics inline.

## OPEN QUESTIONS (pick sensible defaults, note them in code comments)

- Boss trigger points: assumed **after Chambers 3, 6, 9** (three sweepers) and
  **after Chamber 10** (final). Confirm if "every 3 levels" was meant literally
  differently.
- Failure penalty on a bad hit: assumed **restart that boss fight** (not the
  whole campaign, not a lives system).
- Final boss damage: assumed **sword-only** (`h`), 10 hits; the three sweepers
  are **stomp-only**.
- Persistence: whether the sword and boss-clear progress should survive reload
  (default: mirror `maxReached`).
