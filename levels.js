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
const W = (n) => "~".repeat(n);
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

  /* ---------- 4 : deadly water, wider --------------------------- */
  mk("Chamber 04 — Don't Get Wet", true,
    "A wider, deadlier pool. Same idea: portal from the left wall to the right wall to cross in one step, aiming your exit high so you land on the dry ledge by the door. Carry the cube the whole way — touching water restarts the chamber.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([3, "P"], [11, "C"], [39, PLATE], [48, "D"]),
      R([0, X(14)], [14, W(24)], [38, X(14)]),
      R([0, X(14)], [14, W(24)], [38, X(14)]),
      R([0, X(14)], [14, W(24)], [38, X(14)]),
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
      R([3, "P"], [9, "C"]),
      R([0, X(11)], [11, "^"], [12, "X"], [13, W(39)]),
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

  /* ---------- 8 : the wide pool --------------------------------- */
  mk("Chamber 08 — The Long Pool", true,
    "A wide, deadly pool with concrete side walls. Line up a portal on each side wall to cross in one clean step — your exit height decides where you land, so aim high and drop onto the dry ledge by the door.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([3, "P"], [11, "C"], [39, PLATE], [48, "D"]),
      R([0, X(13)], [13, W(25)], [38, X(14)]),
      R([0, X(13)], [13, W(25)], [38, X(14)]),
      R([0, X(13)], [13, W(25)], [38, X(14)]),
    ]),

  /* ---------- 9 : longer crossing ------------------------------- */
  mk("Chamber 09 — The Channel", true,
    "A long deadly channel. Portal from the left wall to the right wall to cross it, exit aimed high so you drop cleanly onto the plate ledge beside the door. Keep the cube in your arms across the whole span.",
    [
      R(), R(), R(), R(), R(), R(), R(), R(),
      R([3, "P"], [11, "C"], [38, PLATE], [48, "D"]),
      R([0, X(15)], [15, W(20)], [35, X(17)]),
      R([0, X(15)], [15, W(20)], [35, X(17)]),
      R([0, X(15)], [15, W(20)], [35, X(17)]),
    ]),

  /* ---------- 10 : the gauntlet --------------------------------- */
  mk("Chamber 10 — The Gauntlet", true,
    "Everything at once: a deadly pool, a trampoline and a floating block. Cross the water and land your exit portal high on the right wall to drop onto the wide plate ledge beside the door. Take it a portal at a time.",
    [
      R(), R(), R(), R(), R(), R(),
      R([17, "######"]),
      R(),
      R([3, "P"], [11, "C"], [38, PLATE], [48, "D"]),
      R([0, X(11)], [11, "^"], [12, "X"], [13, W(21)], [34, X(18)]),
      R([0, X(13)], [13, W(21)], [34, X(18)]),
      R([0, X(13)], [13, W(21)], [34, X(18)]),
    ]),
];

if (typeof module !== "undefined") module.exports = { LEVELS };
