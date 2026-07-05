/*
 * ASCII PORTAL — level data
 * ------------------------------------------------------------------
 * Legend:
 *   ' '  empty air
 *   '#'  concrete wall  -> PORTALABLE (you can shoot portals onto it)
 *   'X'  metal wall     -> solid, NOT portalable
 *   '~'  water          -> deadly, falling in restarts the chamber
 *   '^'  trampoline     -> launches you (and cubes) upward
 *   '_'  pressure plate -> put the cube here to open the door
 *   'D'  exit door      -> opens once the plate is pressed (auto-extends up 1)
 *   'C'  cube spawn
 *   'P'  player spawn
 *
 * Design invariant that guarantees solvability: every gun level has concrete
 * ('#') left & right boundary walls for their full height, the player starts
 * by the left wall, and the goal ledge is attached to the right wall in the
 * lower-middle with CLEAR airspace above it. So a "shoot the left wall, shoot
 * the right wall up high, walk through and drop onto the ledge" solution
 * always exists. Trampolines, pillars and floating blocks add flavour and
 * shorter routes. Rooms are tall to keep firing lanes comfortable.
 */

const INNER = 38;                 // interior width (borders add 2 -> 40)

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

const LEVELS = [
  /* ---------- 1 : no gun, learn grab / drop --------------------- */
  mk("Chamber 01 — Manual Labor", false,
    "No gun yet. Walk to the cube and press E to grab it, carry it onto the glowing plate, and press E to drop. The door opens once the cube rests on the plate — then walk through it.",
    [
      R(), R(), R(), R(),
      R([2, "P"], [9, "C"], [20, "_"], [32, "D"]),
    ]),

  /* ---------- 2 : first portals — cross deadly water ------------ */
  mk("Chamber 02 — The Gap", true,
    "This channel is too wide to jump and the water is deadly. The side walls are concrete. Shoot a BLUE portal (L-Click) on the LEFT wall and an ORANGE portal (R-Click) high on the RIGHT wall, then walk into the blue one — you'll drop out the orange onto the far ledge. Carry the cube.",
    [
      R(), R(), R(), R(), R(),
      R([2, "P"], [9, "C"], [28, "_"], [34, "D"]),
      R([0, X(12)], [12, W(16)], [28, X(10)]),
      R([0, X(12)], [12, W(16)], [28, X(10)]),
      R([0, X(12)], [12, W(16)], [28, X(10)]),
    ]),

  /* ---------- 3 : gain height onto a ledge ---------------------- */
  mk("Chamber 03 — The High Ledge", true,
    "The plate sits on a ledge too high to jump to. A portal drops you wherever its twin is. Put a portal LOW on the left wall next to you and the other one on the RIGHT wall a little above the ledge, then step through and drop onto it with the cube.",
    [
      R(), R(), R(), R(),
      R([26, "_"], [33, "D"]),
      R([24, X(14)]),
      R(), R(),
      R([3, "P"], [10, "C"]),
    ]),

  /* ---------- 4 : deadly water, tighter ------------------------- */
  mk("Chamber 04 — Don't Get Wet", true,
    "A wider, deadlier pool. Same idea: portal from the left wall to the right wall to cross in one step, aiming your exit high so you land on the dry ledge. Carry the cube the whole way — touching water restarts the chamber.",
    [
      R(), R(), R(), R(), R(),
      R([2, "P"], [9, "C"], [29, "_"], [35, "D"]),
      R([0, X(10)], [10, W(20)], [30, X(8)]),
      R([0, X(10)], [10, W(20)], [30, X(8)]),
      R([0, X(10)], [10, W(20)], [30, X(8)]),
    ]),

  /* ---------- 5 : trampoline + portal --------------------------- */
  mk("Chamber 05 — Bounce", true,
    "Meet the trampoline (^) — it launches you upward. You can solve this with the side walls like before, but try bouncing up to the floating block, shooting a portal onto it, and putting the twin high on the right wall to reach the ledge.",
    [
      R(), R(), R(),
      R([13, "##"]),
      R([26, "_"], [33, "D"]),
      R([24, X(14)]),
      R(), R(),
      R([3, "P"], [9, "C"], [19, "^"]),
    ]),

  /* ---------- 6 : trampoline over water ------------------------- */
  mk("Chamber 06 — Over the Drink", true,
    "Water below, ledge above. Cross with a side-wall portal pair, or bounce off the trampoline to the floating block and portal across from there. Keep the cube in your arms — dropping it in the water loses it.",
    [
      R(), R(), R(),
      R([14, "####"]),
      R([28, "_"], [34, "D"]),
      R([26, X(12)]),
      R(),
      R([3, "P"], [6, "C"]),
      R([0, X(8)], [8, "^"], [9, "X"], [10, W(28)]),
    ]),

  /* ---------- 7 : pillars in the pool --------------------------- */
  mk("Chamber 07 — Stepping Stones", true,
    "Concrete pillars rise out of the water — you can portal between their faces to hop across. Or just fire high across the whole room from one side wall to the other. Either way, reach the wide plate ledge on the right.",
    [
      R(), R(), R(),
      R([24, "_"], [31, "D"]),
      R([22, X(16)]),
      R(), R(),
      R([3, "P"], [7, "C"], [12, "#"], [21, "#"]),
      R([0, X(9)], [9, W(16)], [25, X(13)], [12, "#"], [21, "#"]),
    ]),

  /* ---------- 8 : the wide pool + portalable ceiling ------------ */
  mk("Chamber 08 — The Long Pool", true,
    "A wide, deadly pool with concrete side walls and a broken concrete ceiling. Line up a portal on each side wall to cross in one clean step — your exit height decides where you land, so aim for the dry ledge.",
    [
      R([0, H(10)], [22, H(16)]),
      R(), R(), R(),
      R([3, "P"], [7, "C"], [30, "_"], [35, "D"]),
      R([0, X(10)], [10, W(19)], [29, X(9)]),
      R([9, W(20)]),
      R([9, W(20)]),
      R([9, W(20)]),
    ]),

  /* ---------- 9 : cross the water, trampoline flavour ----------- */
  mk("Chamber 09 — Two-Stage", true,
    "Portal across the deadly water to the ledge on the right. There's a trampoline over there too if you want to bounce around — but a clean side-wall portal pair, exit aimed high, will drop you right onto the plate ledge with the cube.",
    [
      R(), R(), R(), R(),
      R([30, "_"], [35, "D"]),
      R([28, X(10)]),
      R([3, "P"], [6, "C"], [24, "^"]),
      R([0, X(10)], [10, W(13)], [23, X(15)]),
      R([0, X(10)], [10, W(13)], [23, X(15)]),
    ]),

  /* ---------- 10 : the gauntlet --------------------------------- */
  mk("Chamber 10 — The Gauntlet", true,
    "Everything at once: a deadly pool, a trampoline, floating blocks and a plate ledge by the right wall. Cross the water and land your exit portal up on the right wall to drop onto the ledge. Take it a portal at a time.",
    [
      R(), R(),
      R([10, "###"]),
      R(),
      R([28, "_"], [34, "D"]),
      R([26, X(12)]),
      R(),
      R([3, "P"], [6, "C"]),
      R([0, X(8)], [8, "^"], [9, "X"], [10, W(20)], [30, X(8)]),
    ]),
];

if (typeof module !== "undefined") module.exports = { LEVELS };
