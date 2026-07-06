# ASCII PORTAL

A browser clone of *Portal*, rendered entirely in text. Fire two linked
portals to bend space, carry the Weighted Cube onto a pressure plate to open the
exit door, and clear ten test chambers — complete with deadly water, safe
swimmable water, trampolines, and a vertical portal-climb.

Pure vanilla JavaScript. **No build step, no dependencies, no server required.**

---

## Run it

Just open the folder's `index.html` in a browser:

```
open index.html          # macOS
```

or serve it statically (any static host works — it's a static site):

```
python3 -m http.server 8000     # then visit http://localhost:8000
```

Click the game screen once so it has keyboard focus, then press any key to start.

It also deploys as-is to any static host (GitHub Pages, Netlify, Render static
site with publish dir `.`, itch.io HTML5, etc.).

---

## Controls

| Input | Action |
| --- | --- |
| `A` `D` / `←` `→` | move |
| `W` / `Space` / `↑` | jump — or **swim up** while in water |
| Mouse | aim the portal gun |
| Left-click / `Q` | fire the **blue** portal |
| Shift-click / `F` | fire the **orange** portal |
| `E` | grab / drop the cube (drops straight down) |
| `T` | throw the cube forward in an arc |
| `Shift` | crouch (shrinks your hitbox in place) |
| `R` | restart the current chamber |

**Momentum is preserved through portals** ("speedy thing goes in, speedy thing
comes out") — a fall through a floor portal becomes a horizontal launch out a
wall portal. Portals only stick to **concrete** (`▓` shaded) walls, not the
riveted **metal** ones.

There's a **chamber selector dropdown** in the side panel. It's locked to
chambers you've reached, unlocks as you progress, and remembers your progress
across page reloads.

---

## The chambers

| # | Name | Focus |
| --- | --- | --- |
| 1 | Manual Labor | No gun yet — learn to grab/drop the cube. Rewards the Portal Device on completion. |
| 2 | The Gap | First portals: cross deadly water via the side walls. |
| 3 | The High Ledge | Gain height — exit a portal onto a raised ledge. |
| 4 | **The Ascent** | Vertical shaft: portal-hop up ledge to ledge to the top plate, then ride back down to the exit. |
| 5 | Bounce | Meet the trampoline. |
| 6 | Over the Drink | Trampoline over water. |
| 7 | Stepping Stones | Portalable pillars in a pool. |
| 8 | **The Reservoir** | A deep pool of **safe, swimmable** water — portal across *or* just dive in and swim. |
| 9 | **Two Waters** | Safe blue swim pool on the left, deadly purple channel on the right you must portal over. |
| 10 | The Gauntlet | Water, trampoline and floating block combined. |

### Two kinds of water
- **Purple (`~`) = deadly.** Falling in restarts the chamber.
- **Blue (`w`) = safe & swimmable.** Buoyant; hold jump/up to stroke upward,
  sink gently otherwise. Never kills you and never loses the cube.

---

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | page shell, side HUD panel, chamber-selector dropdown |
| `styles.css` | CRT-ish theme and per-token colors |
| `game.js` | engine: physics, portals, input, ASCII renderer, game flow |
| `levels.js` | the ten chamber layouts (data) |

### How it works
The world is a **2.5D side-view platformer on a character grid** (not a
first-person raycaster). Physics runs on floats at a fixed 1/120 s timestep and
rounds to cells at draw time. Each frame the engine rasterizes the tile grid into
a shaded character buffer, animates water/trampolines, then blits the player,
cube, portals, the framed door, and an aim-tracking gun barrel on top. A
`SCALE` factor (currently 2) enlarges the whole world — chambers, player, cube
and physics — uniformly, so it plays identically but bigger, with room for a
proper multi-cell door.

Key techniques:
- **Portal firing** uses DDA grid traversal, so the wall face (and portal
  orientation) is always unambiguous — no dependence on aim precision.
- **Teleport** rotates the entity's velocity by the difference between the two
  portals' orientations, preserving speed (the fling).
- **Door** is built procedurally as a `DOOR_W × DOOR_H` framed sprite that stands
  on the floor at the `D` marker and blocks until the plate is pressed.

### Adding / editing a level
Levels live in `levels.js`, authored small and blown up by `SCALE` at load time.
Use the `mk()` / `R()` builders (they guarantee uniform width and borders).
`R([col,"str"], …)` paints strings onto a blank interior row.

Tile legend:
```
' '  air                 '^'  trampoline (launches up)
'#'  concrete (PORTALABLE)   '_'  pressure plate (use several for a wide plate)
'X'  metal (not portalable)  'D'  exit door (a big framed door is built here)
'~'  deadly water        'C' / 'P'  cube / player spawn
'w'  safe swim water
```
Design rule for a guaranteed crossing: keep the left/right boundary walls
concrete (`gun: true` does this) and put the goal ledge low-right with clear air
above it, so "blue on the left wall, orange high on the right, walk through and
drop onto the ledge beside the door" always works.

---

## Verification
All ten chambers are proven solvable by **headless simulation** that plays the
intended solution with the real engine code:
- a **crossing solver** (fires the side walls, walks the cube across) for the
  nine horizontal chambers, and
- a **vertical solver** (chains portal-hops up the shaft) for chamber 4.

Physics, rendering, momentum-preservation, crouch, throw, and the swim mechanic
were each verified with focused headless tests.

---

## Known limitations / possible next steps
- **No fling-required level yet.** Momentum flinging works, but every chamber is
  solvable without it (flings are hard to aim). A wide deadly pit that *needs* a
  floor→wall fling would be a good late-game difficulty spike.
- **Verified by simulation, not exhaustive playtesting** — the *feel* (jump
  height, run speed, aim sensitivity) may still want hands-on tuning; all live at
  the top of `game.js`.
- **Square cells are available but off.** Monospace glyphs are taller than wide,
  so the world is slightly vertically stretched. A measured `line-height` fix
  (`squareUpCells()` in `game.js`) makes cells square — currently commented out.
- No sound, no scrolling camera (each chamber fits on one screen), no story/
  elevator cutscenes (a simple loading screen plays between chambers instead).

---

🤖 Built collaboratively with Claude Code.
