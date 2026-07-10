/*
 * ASCII PORTAL — level data
 * ------------------------------------------------------------------
 * Legend:
 *   ' '  empty air
 *   '#'  concrete wall  -> PORTALABLE (you can shoot portals onto it)
 *   'X'  metal wall     -> solid, NOT portalable
 *   '~'  water          -> deadly, falling in restarts the chamber
 *   '^'  trampoline     -> launches you (and cubes) upward
 *   '_'  pressure plate -> put the cube here to open the door (use several
 *                          in a row for a wide plate)
 *   'D'  exit door      -> a big framed door is built here; opens once the
 *                          plate is pressed
 *   'C'  cube spawn
 *   'P'  player spawn
 *
 * These maps are authored small, then the engine blows them up by SCALE (2x)
 * at load time, so keep them roomy. Design invariant that guarantees a
 * solution: concrete ('#') left & right boundary walls full height, the
 * player starts by the left wall, and the goal ledge sits against the right
 * wall with the wide plate and the door spaced apart and CLEAR airspace above
 * for the firing lane. So "blue on the left wall, orange high on the right
 * wall, walk through and drop onto the ledge beside the door" always works.
 */

const INNER = 52;                 // interior width (borders add 2)

// paint placements onto a blank interior row: R([col,"str"], ...)
function R(...placements) {
  const a = Array(INNER).fill(" ");
  for (const [c, s] of placements)
    for (let k = 0; k < s.length; k++)
      if (c + k >= 0 && c + k < INNER) a[c + k] = s[k];
  return a.join("");
}

// wrap interior rows in borders (concrete for gun levels, metal for L1)
function mk(name, gun, hint, interior) {
  const b = gun ? "#" : "X";
  const solid = "X".repeat(INNER + 2);
  const rows = [solid];
  for (const line of interior) rows.push(b + line.padEnd(INNER, " ").slice(0, INNER) + b);
  rows.push(solid);
  return { name, gun, hint, rows };
}

const X = (n) => "X".repeat(n);
const H = (n) => "#".repeat(n);
const W = (n) => "~".repeat(n);      // deadly water (purple)
const SW = (n) => "w".repeat(n);     // safe, swimmable water (blue)
const PLATE = "___";              // wide (3-cell) pressure plate

const LEVELS = [
  /* ---------- 1 : no gun, learn grab / drop --------------------- */
  mk("Chamber 01 — Manual Labor", false,
    "No gun yet. Walk to the cube and press E to grab it, carry it onto the glowing plate, and press E to drop. The door opens once the cube rests on the plate — then walk through it.",
    [
      R(), R(), R(), R(), R(), R(), R(),
      R([5, "P"], [15, "C"], [30, PLATE], [45, "D"]),
    ]),

  /* ---------- 2 : first portals — cross deadly water ------------ */
  mk("Chamber 02 — The Gap", true,
    "This channel is too wide to jump and the water is deadly. The side walls are concrete. Aim with the mouse, shoot a BLUE portal (Click or Q) on the LEFT wall and an ORANGE portal (Shift-Click or F) high on the RIGHT wall, then walk into the blue one to drop out the orange onto the far ledge beside the door. Carry the cube.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([3, "P"], [11, "C"], [37, PLATE], [47, "D"]),
      R([0, X(17)], [17, W(18)], [35, X(17)]),
      R([0, X(17)], [17, W(18)], [35, X(17)]),
      R([0, X(17)], [17, W(18)], [35, X(17)]),
    ]),

  /* ---------- 3 : gain height onto a ledge ---------------------- */
  mk("Chamber 03 — The High Ledge", true,
    "The plate sits on a ledge too high to jump to. A portal drops you wherever its twin is. Put a portal LOW on the left wall next to you and the other one high on the RIGHT wall above the ledge, then step through and drop onto it, left of the door, with the cube.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([36, PLATE], [46, "D"]),
      R([31, X(21)]),
      R(), R(), R(), R(),
      R([4, "P"], [13, "C"]),
    ]),

  /* ---------- 4 : vertical portal climb ------------------------- */
  mk("Chamber 04 — The Ascent", true,
    "Climb the shaft with portals: put one on the wall beside you and its twin high on the OPPOSITE wall, step through and drop onto the ledge. Hop to the right ledge, then up to the PLATE at the top-left. Drop the cube there and the door opens far below — then ride back down and walk out.",
    [
      R(),                        //  0
      R(),                        //  1
      R(),                        //  2
      R([2, PLATE]),              //  3  top plate (no door here, so nothing blocks the shot)
      R([0, X(10)]),              //  4  top-left ledge
      R(),                        //  5
      R(),                        //  6
      R(),                        //  7
      R([43, X(9)]),              //  8  ledge 1 (right wall)
      R(),                        //  9
      R(),                        // 10
      R(),                        // 11
      R(),                        // 12
      R(),                        // 13
      R(),                        // 14
      R([6, "P"], [13, "C"], [30, "D"]),  // 15  start + exit door (bottom)
      R([0, X(52)]),              // 16  floor
    ]),

  /* ---------- 5 : trampoline + portal --------------------------- */
  mk("Chamber 05 — Bounce", true,
    "Meet the trampoline (^) — it launches you upward. You can solve this with the side walls like before, but try bouncing up to the floating block, shooting a portal onto it, and putting the twin high on the right wall to reach the ledge.",
    [
      R(), R(), R(), R(),
      R([17, "####"]),
      R([17, "####"]),
      R(),
      R([36, PLATE], [46, "D"]),
      R([31, X(21)]),
      R(), R(),
      R([4, "P"], [12, "C"], [23, "^^^"]),
    ]),

  /* ---------- 6 : trampoline over water ------------------------- */
  mk("Chamber 06 — Over the Drink", true,
    "Water below, ledge above. Cross with a side-wall portal pair, or bounce off the trampoline to the floating block and portal across from there. Keep the cube in your arms — dropping it in the water loses it.",
    [
      R(), R(), R(), R(),
      R([18, "#####"]),
      R(), R(),
      R([37, PLATE], [47, "D"]),
      R([33, X(19)]),
      R(),
      R([3, "P"], [5, "C"]),
      R([0, X(8)], [8, "^^^"], [11, "XX"], [13, W(39)]),
    ]),

  /* ---------- 7 : pillars in the pool --------------------------- */
  mk("Chamber 07 — Stepping Stones", true,
    "Concrete pillars rise out of the deadly pool. Fire a portal high across the whole room from one side wall to the other and drop onto the far ledge — or use the pillars as extra footing. Reach the wide plate by the door.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([3, "P"], [11, "C"], [37, PLATE], [47, "D"]),
      R([0, X(15)], [15, "#"], [16, W(6)], [22, "#"], [23, W(6)], [29, "#"], [30, W(5)], [35, X(17)]),
      R([0, X(15)], [15, "#"], [16, W(6)], [22, "#"], [23, W(6)], [29, "#"], [30, W(5)], [35, X(17)]),
      R([0, X(15)], [15, "#"], [16, W(6)], [22, "#"], [23, W(6)], [29, "#"], [30, W(5)], [35, X(17)]),
    ]),

  /* ---------- 8 : deep, safe swim pool -------------------------- */
  mk("Chamber 08 — The Reservoir", true,
    "This blue water is SAFE — hold jump / up to stroke upward and swim. Reach the plate on the far ledge however you like: portal across from the side walls, or just dive in and swim over. No way to lose the cube in here.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([3, "P"], [11, "C"], [37, PLATE], [47, "D"]),
      R([0, X(15)], [15, SW(20)], [35, X(17)]),
      R([0, X(15)], [15, SW(20)], [35, X(17)]),
      R([0, X(15)], [15, SW(20)], [35, X(17)]),
    ]),

  /* ---------- 9 : swim pool + deadly gap ------------------------ */
  mk("Chamber 09 — Two Waters", true,
    "Two kinds of water: the blue pool on the left is safe to swim, the purple channel on the right is deadly. Wade through the blue if you want, but you must PORTAL over the purple to reach the plate. Side wall to side wall, exit aimed high.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([3, "P"], [11, "C"], [43, PLATE], [49, "D"]),
      R([0, X(12)], [12, SW(14)], [26, X(6)], [32, W(8)], [40, X(12)]),
      R([0, X(12)], [12, SW(14)], [26, X(6)], [32, W(8)], [40, X(12)]),
      R([0, X(12)], [12, SW(14)], [26, X(6)], [32, W(8)], [40, X(12)]),
    ]),

  /* ---------- 10 : the gauntlet --------------------------------- */
  mk("Chamber 10 — The Gauntlet", true,
    "Everything at once: a deadly pool, a trampoline and a floating block. Cross the water and land your exit portal high on the right wall to drop onto the wide plate ledge beside the door. Take it a portal at a time.",
    [
      R(), R(), R(), R(), R(), R(),
      R([17, "######"]),
      R(),
      R([3, "P"], [6, "C"], [38, PLATE], [48, "D"]),
      R([0, X(8)], [8, "^^^"], [11, "XX"], [13, W(21)], [34, X(18)]),
      R([0, X(13)], [13, W(21)], [34, X(18)]),
      R([0, X(13)], [13, W(21)], [34, X(18)]),
    ]),
];

/*
 * BOSS FIGHTS — not part of LEVELS (so they never show up in the chamber
 * selector). Sweeper bosses trigger AFTER Chambers 3, 6 and 9; the final boss
 * triggers after Chamber 10. Sweepers hover-and-sweep across a plain arena and
 * die to STOMPS (jump onto their top). The final boss is massive, lives in an
 * animated mosaic room, and only takes damage from the SWORD (press H).
 *
 * Fields:
 *   name   — shown on the in-arena health bar
 *   hits   — stomps (or sword strikes) needed to kill
 *   bw,bh  — collision box size in (already-scaled) cells
 *   speed  — horizontal sweep speed, UNSCALED (enterBoss multiplies by SCALE;
 *            keep it SCALE-free here since levels.js loads before game.js)
 *   final  — true only for the last boss (sword-only, mosaic room)
 *   cls    — color token (see .t-* rules in styles.css)
 *   sprite — multi-row ASCII art, drawn centered on the collision box
 */
const BOSSES = [
  /* ---- Boss 1 (after Chamber 3): 3 stomps ---- */
  { name: "SENTRY MK-I", hits: 3, bw: 9, bh: 4, speed: 20, final: false, cls: "boss1",
    sprite: [
      "  ▄█████▄  ",
      " ▟█◉███◉█▙ ",
      " ███▀▀▀███ ",
      " ▜███████▛ ",
      "  ▀▟█▙▟█▙▀ ",
    ] },

  /* ---- Boss 2 (after Chamber 6): 4 stomps, bigger ---- */
  { name: "GUARDIAN-X", hits: 4, bw: 12, bh: 5, speed: 24, final: false, cls: "boss2",
    sprite: [
      "   ▄▄████▄▄   ",
      "  ▟██◉██◉██▙  ",
      " ▟████▀▀████▙ ",
      " ██▛██████▜██ ",
      " ▜██████████▛ ",
      "   ▀▜██▛▀▜▛▀  ",
    ] },

  /* ---- Boss 3 (after Chamber 9): 5 stomps, bigger still ---- */
  { name: "OMEGA CORE", hits: 5, bw: 14, bh: 6, speed: 27, final: false, cls: "boss3",
    sprite: [
      "    ▄▄▄▄▄▄▄▄    ",
      "  ▄██████████▄  ",
      " ▟███◉████◉███▙ ",
      " ████▄▄▄▄▄▄████ ",
      " ██▛██▀██▀██▜██ ",
      "  ▜██████████▛  ",
      "    ▀▀▜██▛▀▀    ",
    ] },

  /* ---- Final boss (after Chamber 10): 10 SWORD hits, massive ---- */
  { name: "THE ARCHITECT", hits: 10, bw: 24, bh: 10, speed: 11, final: true, cls: "bossF",
    sprite: [
      "        ▄▄▄██████████▄▄▄        ",
      "     ▄██████████████████▄     ",
      "   ▄██████◉██████◉██████▄   ",
      "  ████████████████████████  ",
      " ██████▛▀▀▀▀▀▀▀▀▀▀▀▀▀▜██████ ",
      " █████▌  ▄▄▄▄▄▄▄▄▄▄  ▐█████ ",
      " █████▌  █▀█▀█▀█▀█▀  ▐█████ ",
      " ██████▙▄▄▄▄▄▄▄▄▄▄▄▄▟██████ ",
      "  ████████████████████████  ",
      "   ▜██████████████████████▛   ",
      "     ▀▜████▛▀▀  ▀▀▜████▛▀     ",
      "        ▀▀▀        ▀▀▀        ",
    ] },
];

if (typeof module !== "undefined") module.exports = { LEVELS, BOSSES };
