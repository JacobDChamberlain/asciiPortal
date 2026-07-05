# ASCII PORTAL

A browser clone of *Portal*, rendered entirely in text. Fire two linked
portals to bend space, carry the Weighted Cube onto the pressure plate to open
the exit door, and clear ten increasingly tricky test chambers — complete with
deadly water and trampolines.

## Run it

No build step, no dependencies. Just open the folder in a browser:

```
open index.html          # macOS
```

or serve it (any static server works), e.g.:

```
python3 -m http.server 8000     # then visit http://localhost:8000
```

Click the game screen once so it has keyboard focus, then press any key to start.

## Controls

| Key | Action |
| --- | --- |
| `A` `D` / `←` `→` | move |
| `W` / `Space` / `↑` | jump |
| Mouse | aim the portal gun |
| Left-click | fire the **blue** portal |
| Right-click | fire the **orange** portal |
| `E` | grab / drop the cube |
| `R` | restart the current chamber |

Walk into one portal to come out the other — **momentum is preserved** ("speedy
thing goes in, speedy thing comes out"), so you can fling yourself and fall out
sideways. Portals only stick to **concrete** walls (the shaded `▓` surfaces),
not the riveted metal ones.

## The chambers

1. **Manual Labor** — no gun yet; learn to grab and drop the cube on the plate.
   Finish it and you're awarded the Handheld Portal Device.
2. **The Gap** – first portals: cross deadly water using the side walls.
3. **The High Ledge** – use portals to gain height.
4. **Don't Get Wet** – a wider pool.
5. **Bounce** – meet the trampoline.
6. **Over the Drink** – trampoline + water.
7. **Stepping Stones** – portalable pillars in a pool.
8. **The Long Pool** – a wide crossing with a portalable ceiling.
9. **Two-Stage** – cross, then bounce.
10. **The Gauntlet** – everything at once.

Every chamber from 2 onward is solvable with the reliable "blue on the left
wall, orange high on the right wall, walk through and drop onto the ledge"
technique; trampolines, pillars and floating blocks offer shorter routes.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | page shell + side HUD panel |
| `styles.css` | CRT-ish theme and per-token colors |
| `game.js` | engine: physics, portals, input, ASCII renderer, game flow |
| `levels.js` | the ten chamber layouts (data) |

### How the renderer works

The world is a **2.5D side-view platformer on a character grid** (not a
first-person raycaster). Physics runs on floats at a fixed 1/120 s timestep and
rounds to cells at draw time. Each frame `game.js` rasterizes the tile grid into
a character buffer with shading, animates water/trampolines, then blits the
player, cube, portals and the aim-tracking gun barrel on top. The "holding the
gun" feel comes from that in-world barrel plus the HUD viewmodel on the right.

### How to add a level

Add an entry to the `LEVELS` array in `levels.js` using the `mk()` /`R()`
builder, which guarantees uniform width and correct borders. `R([col,"str"], …)`
paints strings onto a blank 38-wide interior row; `mk(name, gun, hint, rows)`
wraps the rows in boundary walls.

Tile legend:

```
' '  air              '^'  trampoline (launches up)
'#'  concrete (PORTALABLE)   '_'  pressure plate
'X'  metal (not portalable)  'D'  exit door
'~'  deadly water     'C'/'P'  cube / player spawn
```

Design rule for a guaranteed-solvable chamber: keep the left and right boundary
walls concrete (`gun: true` does this), start the player by the left wall, and
put the goal ledge against the right wall in the lower-middle with clear air
above it so there's a comfortable portal-firing lane.

## Notes / known rough edges

- Levels are a solid first pass, tuned so each is provably crossable (verified by
  a headless simulation of the intended solution). Difficulty is deliberately
  gentle — the pieces are in place to make later chambers meaner.
- Momentum flinging works but the chambers don't yet *require* long falls; that's
  a natural next step for harder levels.
