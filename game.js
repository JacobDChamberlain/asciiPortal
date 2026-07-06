/* =====================================================================
 * ASCII PORTAL  —  a browser Portal clone rendered entirely in text.
 *
 * DESIGN NOTE (stated up front, per the brief): the world is a 2.5D
 * side-view platformer on a character grid, NOT a first-person raycaster.
 * This cleanly supports gravity, momentum-preserving portals, trampolines,
 * water and cube-on-plate puzzles, and gets to a *fun, working* build fast.
 * The "holding the gun" feel comes from a HUD viewmodel + an in-world barrel
 * that tracks your aim.
 *
 * Coordinate system: 1 unit == 1 character cell. +x right, +y DOWN (screen
 * coordinates). Physics runs on floats at a fixed timestep; rendering rounds
 * to the nearest cell.
 *
 * Sections:
 *   1. constants / tiles
 *   2. level loading
 *   3. physics (AABB vs. grid, water, trampolines, plates, doors)
 *   4. portals (firing raycast + momentum-preserving teleport)
 *   5. input
 *   6. renderer (shaded ASCII buffer + sprites)
 *   7. game flow (overlays, level transitions) + main loop
 * ===================================================================== */

"use strict";

/* ------------------------------ 1. constants ----------------------- */

// SCALE blows every chamber (and the player/cube/physics with it) up by this
// factor. Because velocities AND gravity scale by SCALE while timing is left
// alone, trajectories keep the same shape — so the game plays identically,
// just twice as big, with room for a proper multi-cell door.
const SCALE = 2;

const CELL = 1;
const GRAVITY   = 58 * SCALE;     // cells / s^2
const MOVE_SPD  = 15 * SCALE;     // horizontal run speed
const JUMP_VEL  = 24 * SCALE;     // initial jump velocity (up is negative)
const TRAMP_VEL = 40 * SCALE;     // trampoline launch velocity
const MAX_FALL  = 60 * SCALE;     // terminal velocity
const GROUND_FRICTION = 14; // rate (1/time) — unscaled
const DT        = 1 / 120;// physics step

const PLAYER_W = 1.7 * SCALE, PLAYER_H = 2.7 * SCALE;
const CROUCH_H = 1.5 * SCALE;
const CUBE_W   = 2.2 * SCALE, CUBE_H = 2.2 * SCALE;

// portal mouth reaches PHALF_CELLS cells to each side of its center, so the
// opening is 2*PHALF_CELLS+1 cells — tall enough for the (scaled) player to
// pass through.
const PHALF_CELLS = Math.max(1, Math.round(1.6 * SCALE));
const TP_COOLDOWN = 0.12; // seconds a body is immune after teleporting
const GRAB_REACH  = 4.0 * SCALE;

const DOOR_W = 6, DOOR_H = 8;     // exit door size in (scaled) cells

// swimmable ('w') water: buoyant, draggy, and you can stroke upward
const SWIM_UP    = 13 * SCALE;    // upward swim-stroke speed
const WATER_DRAG = 2.6;           // velocity damping per second while submerged
const SWIM_BUOY  = 0.82;          // fraction of gravity cancelled by buoyancy

// tile helpers
const isSolidTile = (t) => t === "#" || t === "X" || t === "^" || t === "_" || t === "D";
const isPortalable = (t) => t === "#";

/* ------------------------------ 2. level state --------------------- */

const state = {
  levelIndex: 0,
  grid: [],          // array of char arrays [row][col]
  W: 0, H: 0,
  hasGun: false,
  player: null,
  cube: null,
  carrying: false,
  grabCooldown: 0,
  portals: [null, null],   // [blue, orange]  {cx,cy,nx,ny,tx,ty,holes:Set}
  plateCells: [],          // [{x,y}]
  doorCells: [],           // [{x,y}]
  doorOpen: false,
  frame: 0,
  mouse: { cx: 0, cy: 0, active: false },
  aim: { x: 1, y: 0 },
  facing: 1,
  lastMoveDir: 1,
  fireFlash: 0,            // >0 briefly after firing
  fireWhich: 0,            // 0 = none, 1 = blue, 2 = orange
  mode: "start",           // start | play | loading | reward | won
  overlayTimer: 0,
  deathFlash: 0,
  maxReached: 0,           // furthest chamber unlocked in the selector
};

// remember unlocked progress across reloads (falls back to session-only)
try {
  const saved = parseInt(localStorage.getItem("asciiPortalMaxReached"), 10);
  if (saved > 0) state.maxReached = Math.min(saved, LEVELS.length - 1);
} catch (e) { /* localStorage unavailable */ }

const screenEl  = document.getElementById("screen");
const overlayEl  = document.getElementById("overlay");
const overlayTxt = document.getElementById("overlayText");
const gunViewEl  = document.getElementById("gunView");
const chamberSelect = document.getElementById("chamberSelect");

function tileAt(cx, cy) {
  if (cy < 0 || cy >= state.H || cx < 0 || cx >= state.W) return "X"; // OOB = solid
  return state.grid[cy][cx];
}

function loadLevel(i) {
  const def = LEVELS[i];
  state.levelIndex = i;
  if (i > state.maxReached) {
    state.maxReached = i;
    try { localStorage.setItem("asciiPortalMaxReached", String(i)); } catch (e) {}
  }

  // parse + pad the authored (unscaled) grid
  const w0 = Math.max(...def.rows.map((r) => r.length));
  const base = def.rows.map((r) => {
    const a = r.split("");
    while (a.length < w0) a.push(" ");
    return a;
  });
  const H0 = base.length;

  // pull markers out in authored coords, then clear them (plate stays as a
  // terrain tile; the door is rebuilt as a big multi-cell door below)
  let pOrig = { x: 2, y: 2 }, cOrig = { x: 4, y: 2 }, doorOrig = null;
  for (let y = 0; y < H0; y++)
    for (let x = 0; x < w0; x++) {
      const t = base[y][x];
      if (t === "P") { pOrig = { x, y }; base[y][x] = " "; }
      else if (t === "C") { cOrig = { x, y }; base[y][x] = " "; }
      else if (t === "D") { doorOrig = { x, y }; base[y][x] = " "; }
    }

  // blow the grid up SCALE x SCALE
  const W = w0 * SCALE, H = H0 * SCALE;
  const grid = Array.from({ length: H }, () => Array(W).fill(" "));
  for (let y = 0; y < H0; y++)
    for (let x = 0; x < w0; x++) {
      const t = base[y][x];
      for (let dy = 0; dy < SCALE; dy++)
        for (let dx = 0; dx < SCALE; dx++) grid[y * SCALE + dy][x * SCALE + dx] = t;
    }
  state.grid = grid; state.W = W; state.H = H;

  state.hasGun = state.hasGun || def.gun; // once you have the gun you keep it
  if (i === 0) state.hasGun = false;
  state.portals = [null, null];
  state.plateCells = [];
  state.doorCells = [];
  state.doorRect = null;
  state.doorOpen = false;
  state.carrying = false;
  state.grabCooldown = 0;
  state.frame = 0;

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (grid[y][x] === "_") state.plateCells.push({ x, y });

  if (doorOrig) buildDoor(doorOrig);

  // spawn entities (scaled coords), resting on the floor beneath their marker
  const px = pOrig.x * SCALE + SCALE / 2, py = (pOrig.y + 1) * SCALE;
  const cxp = cOrig.x * SCALE + SCALE / 2, cyp = (cOrig.y + 1) * SCALE;
  state.player = makeBody(px - PLAYER_W / 2, py - PLAYER_H, PLAYER_W, PLAYER_H);
  state.cube   = makeBody(cxp - CUBE_W / 2, cyp - CUBE_H, CUBE_W, CUBE_H);
  state.cube.friction = true;
  settle(state.player);
  settle(state.cube);

  updateHud();
}

// Build a DOOR_W x DOOR_H framed door standing on the floor at the marker.
// Its air cells become solid 'D' tiles (blocking until the plate is pressed);
// the rect is stored so it can be drawn as a proper door sprite.
function buildDoor(doorOrig) {
  const cxCenter = doorOrig.x * SCALE + SCALE / 2;
  const floorTop = (doorOrig.y + 1) * SCALE;         // door stands on this
  let left = Math.round(cxCenter - DOOR_W / 2);
  left = Math.max(1, Math.min(state.W - 1 - DOOR_W, left));
  let h = DOOR_H;
  while (h > 6 && floorTop - h < 1) h--;             // clamp if it hits the ceiling
  const top = floorTop - h;
  state.doorRect = { x: left, y: top, w: DOOR_W, h };
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < DOOR_W; xx++) {
      const gx = left + xx, gy = top + yy;
      if (state.grid[gy] && state.grid[gy][gx] === " ") {
        state.grid[gy][gx] = "D";
        state.doorCells.push({ x: gx, y: gy });
      }
    }
}

function makeBody(x, y, w, h) {
  return { x, y, w, h, vx: 0, vy: 0, onGround: false, friction: false,
           pcx: x + w / 2, pcy: y + h / 2, tpCd: 0 };
}

// Shrink/grow the player's hitbox for crouch, keeping the FEET planted (the
// box bottom stays put). Standing back up is refused if the head would clip a
// ceiling, so you stay crouched under low gaps.
function syncPlayerCrouch() {
  const p = state.player;
  if (!p) return;

  const targetH = isCrouching() ? CROUCH_H : PLAYER_H;
  if (p.h === targetH) return;

  const bottom = p.y + p.h;
  const prevY = p.y, prevH = p.h;
  p.h = targetH;
  p.y = bottom - p.h;

  if (!isCrouching() && bodyHitsSolid(p, false)) { p.y = prevY; p.h = prevH; }
  p.pcx = p.x + p.w / 2;
  p.pcy = p.y + p.h / 2;
}

// player art (drawn feet-anchored, so a shorter set of rows reads as a crouch)
function playerSpriteRows() {
  if (isCrouching()) return [" ██ ", "████", "█  █"];
  return [" ██ ", "████", " ██ ", " ██ ", "█  █"];
}

// drop a freshly-spawned body onto the nearest floor below it
function settle(b) {
  for (let i = 0; i < 200; i++) {
    b.y += 0.25;
    if (bodyHitsSolid(b, false)) { b.y -= 0.25; break; }
  }
}

/* ------------------------------ 3. physics ------------------------- */

// true if a solid tile overlaps the body. If usePortalHoles, cells punched
// out by a portal mouth are treated as passable.
function bodyHitsSolid(b, usePortalHoles) {
  const x0 = Math.floor(b.x + 0.001), x1 = Math.floor(b.x + b.w - 0.001);
  const y0 = Math.floor(b.y + 0.001), y1 = Math.floor(b.y + b.h - 0.001);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (isSolidCell(x, y, usePortalHoles)) return true;
  return false;
}

function isSolidCell(x, y, usePortalHoles) {
  const t = tileAt(x, y);
  if (t === "D") { if (state.doorOpen) return false; }
  else if (!isSolidTile(t)) return false;
  if (usePortalHoles && portalHoleAt(x, y)) return false;
  return true;
}

function portalHoleAt(x, y) {
  for (const p of state.portals)
    if (p && p.holes.has(x + "," + y)) return true;
  return false;
}

// move a body one step with axis-separated AABB collision
function moveBody(b, dt) {
  b.pcx = b.x + b.w / 2;
  b.pcy = b.y + b.h / 2;

  b.vy += GRAVITY * dt;
  // swimmable water: buoyancy cancels most of gravity and drag slows motion
  if (inSwim(b)) {
    b.vy -= GRAVITY * SWIM_BUOY * dt;
    const d = Math.max(0, 1 - WATER_DRAG * dt);
    b.vx *= d; b.vy *= d;
  }
  if (b.vy > MAX_FALL) b.vy = MAX_FALL;

  // ---- X axis ----
  b.x += b.vx * dt;
  if (b.vx > 0) {
    const cx = Math.floor(b.x + b.w - 0.001);
    for (let cy = Math.floor(b.y + 0.001); cy <= Math.floor(b.y + b.h - 0.001); cy++)
      if (isSolidCell(cx, cy, true)) { b.x = cx - b.w; b.vx = 0; break; }
  } else if (b.vx < 0) {
    const cx = Math.floor(b.x + 0.001);
    for (let cy = Math.floor(b.y + 0.001); cy <= Math.floor(b.y + b.h - 0.001); cy++)
      if (isSolidCell(cx, cy, true)) { b.x = cx + 1; b.vx = 0; break; }
  }

  // ---- Y axis ----
  b.onGround = false;
  b.y += b.vy * dt;
  if (b.vy > 0) { // falling
    const cy = Math.floor(b.y + b.h - 0.001);
    for (let cx = Math.floor(b.x + 0.001); cx <= Math.floor(b.x + b.w - 0.001); cx++) {
      if (isSolidCell(cx, cy, true)) {
        b.y = cy - b.h;
        if (tileAt(cx, cy) === "^") b.vy = -TRAMP_VEL;   // bounce!
        else { b.vy = 0; b.onGround = true; }
        break;
      }
    }
  } else if (b.vy < 0) { // rising
    const cy = Math.floor(b.y + 0.001);
    for (let cx = Math.floor(b.x + 0.001); cx <= Math.floor(b.x + b.w - 0.001); cx++)
      if (isSolidCell(cx, cy, true)) { b.y = cy + 1; b.vy = 0; break; }
  }

  // ground friction so free objects (the cube) settle instead of sliding
  // forever. Only applied on the ground, so mid-air momentum through portals
  // is preserved.
  if (b.onGround && b.friction) {
    b.vx -= b.vx * Math.min(1, (GROUND_FRICTION + 6) * dt);
    if (Math.abs(b.vx) < 0.03) b.vx = 0;
  }

  if (b.tpCd > 0) b.tpCd -= dt;
  tryTeleport(b);
}

// is any cell overlapping this body deadly water ('~')?
function inWater(b) {
  const x0 = Math.floor(b.x + 0.001), x1 = Math.floor(b.x + b.w - 0.001);
  const y0 = Math.floor(b.y + 0.001), y1 = Math.floor(b.y + b.h - 0.001);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (tileAt(x, y) === "~") return true;
  return false;
}

// is this body submerged in safe, swimmable water ('w')?
function inSwim(b) {
  const cx = Math.floor(b.x + b.w / 2), cy = Math.floor(b.y + b.h / 2);
  return tileAt(cx, cy) === "w";
}

// pressure plate triggered by the player or the cube, but not by the cube
// while it is being carried.
function bodyOnPlate(body, ignoreWhileCarried) {
  if (!body) return false;
  if (ignoreWhileCarried && state.carrying) return false;
  const bottom = body.y + body.h;
  for (const p of state.plateCells) {
    const overX = body.x < p.x + 1 && body.x + body.w > p.x;
    if (overX && bottom > p.y - 0.35 * SCALE && bottom < p.y + 0.6 * SCALE) return true;
  }
  return false;
}

function platePressed() {
  return bodyOnPlate(state.player, false) || bodyOnPlate(state.cube, true);
}

/* ------------------------------ 4. portals ------------------------- */

const rot = (x, y, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

// Fire from origin along dir; place portal `which` (0 blue / 1 orange).
// Uses DDA grid traversal so the wall FACE we cross (and thus the portal's
// surface normal) is always unambiguous — no dependence on step size or the
// exact sub-cell trajectory, which the old marcher was fragile about.
function firePortal(which, ox, oy, dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  let cx = Math.floor(ox), cy = Math.floor(oy);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx !== 0 ? (stepX > 0 ? cx + 1 - ox : ox - cx) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (stepY > 0 ? cy + 1 - oy : oy - cy) * tDeltaY : Infinity;

  for (let i = 0; i < 400; i++) {
    let nx = 0, ny = 0, t;
    if (tMaxX < tMaxY) { t = tMaxX; cx += stepX; nx = -stepX; tMaxX += tDeltaX; }
    else               { t = tMaxY; cy += stepY; ny = -stepY; tMaxY += tDeltaY; }
    if (cx < 0 || cx >= state.W || cy < 0 || cy >= state.H) return false;
    const tile = tileAt(cx, cy);
    if (tile === "X" || tile === "D") return false;          // blocked, no portal
    if (isPortalable(tile))
      return placePortal(which, cx, cy, nx, ny, ox + dx * t, oy + dy * t);
  }
  return false;
}

// place a portal of length 3 centered near (hitX,hitY) on the face given by
// normal (nx,ny), backed by concrete cells behind the surface.
function placePortal(which, wallX, wallY, nx, ny, hitX, hitY) {
  const tx = -ny, ty = nx;               // tangent along the wall
  // surface position (the plane the mouth sits on)
  let surfX, surfY;
  if (nx !== 0) { surfX = nx > 0 ? wallX + 1 : wallX; surfY = hitY; }
  else          { surfY = ny > 0 ? wallY + 1 : wallY; surfX = hitX; }

  // center along tangent, clamped so all backing cells are concrete
  let cAlong = (nx !== 0) ? surfY : surfX;
  const backOf = (along) => {
    // integer cell just behind the surface at tangent position `along`
    if (nx !== 0) return { x: wallX, y: Math.floor(along) };
    return { x: Math.floor(along), y: wallY };
  };
  // try the hit position, then nudge until the whole mouth is backed by concrete
  const fits = (center) => {
    for (let d = -PHALF_CELLS; d <= PHALF_CELLS; d++) {
      const b = backOf(center + d);
      if (!isPortalable(tileAt(b.x, b.y))) return false;
    }
    return true;
  };
  let center = cAlong;
  if (!fits(center)) {
    let placed = false;
    for (let off = 0; off <= PHALF_CELLS + 1; off++) {
      if (fits(center + off)) { center += off; placed = true; break; }
      if (fits(center - off)) { center -= off; placed = true; break; }
    }
    if (!placed) return false;
  }

  const cx = (nx !== 0) ? surfX : center;
  const cy = (nx !== 0) ? center : surfY;

  // holes: the wall cells the mouth punches through. Punch SCALE+1 cells deep
  // (opposite the normal) so a body can push its centre all the way to the
  // surface plane through a thick, scaled-up wall.
  const holes = new Set();
  const depth = SCALE + 1;
  for (let d = -PHALF_CELLS; d <= PHALF_CELLS; d++) {
    const b = backOf(center + d);
    for (let k = 0; k < depth; k++)
      holes.add((b.x - nx * k) + "," + (b.y - ny * k));
  }

  state.portals[which] = { cx, cy, nx, ny, tx, ty, holes };
  updateHud();
  return true;
}

// teleport a body if its center just crossed a portal's surface inward
function tryTeleport(b) {
  if (b.tpCd > 0) return;
  const cxNow = b.x + b.w / 2, cyNow = b.y + b.h / 2;
  for (let i = 0; i < 2; i++) {
    const A = state.portals[i], B = state.portals[1 - i];
    if (!A || !B) continue;
    const dPrev = (b.pcx - A.cx) * A.nx + (b.pcy - A.cy) * A.ny;
    const dNow  = (cxNow - A.cx) * A.nx + (cyNow - A.cy) * A.ny;
    const tNow  = (cxNow - A.cx) * A.tx + (cyNow - A.cy) * A.ty;
    // moving inward (from the air side toward/through the surface)
    if (dPrev > 0 && dNow <= 0.3 && Math.abs(tNow) <= PHALF_CELLS + 0.5) {
      teleport(b, A, B);
      return;
    }
  }
}

function teleport(b, A, B) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const rel = { x: cx - A.cx, y: cy - A.cy };
  // rotation that turns the incoming direction (-A.normal) into B's normal
  const aIn = Math.atan2(-A.ny, -A.nx);
  const aOut = Math.atan2(B.ny, B.nx);
  const dth = aOut - aIn;

  const nr = rot(rel.x, rel.y, dth);
  const nv = rot(b.vx, b.vy, dth);
  const push = (b.w + b.h) / 4 + 0.7 * SCALE;

  const ncx = B.cx + nr.x + B.nx * push;
  const ncy = B.cy + nr.y + B.ny * push;
  b.x = ncx - b.w / 2;
  b.y = ncy - b.h / 2;
  b.vx = nv.x; b.vy = nv.y;
  b.tpCd = TP_COOLDOWN;
  b.pcx = b.x + b.w / 2; b.pcy = b.y + b.h / 2;
}

/* ------------------------------ 5. input --------------------------- */

const keys = {};
// both Shift keys report e.key === "Shift", so one check covers them
function isCrouching() { return !!keys.shift; }

function getHorizontalMove() {
  let move = 0;
  if (keys["a"] || keys["arrowleft"]) move -= 1;
  if (keys["d"] || keys["arrowright"]) move += 1;
  return move;
}

function getThrowDirection() {
  if (keys["a"] || keys["arrowleft"]) return -1;
  if (keys["d"] || keys["arrowright"]) return 1;
  return state.lastMoveDir || state.facing;
}

function beginIfNeeded() {
  if (state.mode === "start") {
    startGame();
  }
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();

  if (state.mode === "start") { beginIfNeeded(); return; }
  if (state.mode !== "play") return;

  if (k === "a" || k === "arrowleft") {
    state.facing = -1;
    state.lastMoveDir = -1;
  }
  if (k === "d" || k === "arrowright") {
    state.facing = 1;
    state.lastMoveDir = 1;
  }
  if (k === "e") tryGrab();
  if (k === "r") loadLevel(state.levelIndex);
  if (k === "q") fire(0);   // keyboard fire: blue portal toward the aim
  if (k === "f") fire(1);   // keyboard fire: orange portal toward the aim
  // hold Shift to crouch (handled by syncPlayerCrouch); Shift+E throws the cube
  keys[k] = true;
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

function updateMouseCell(e) {
  const rect = screenEl.getBoundingClientRect();
  const padL = 10, padT = 10; // matches CSS padding
  const cw = (rect.width - padL * 2) / state.W;
  const ch = (rect.height - padT * 2) / state.H;
  state.mouse.cx = (e.clientX - rect.left - padL) / cw;
  state.mouse.cy = (e.clientY - rect.top - padT) / ch;
  state.mouse.active = true;
}
screenEl.addEventListener("mousemove", updateMouseCell);
screenEl.addEventListener("click", () => {
  beginIfNeeded();
});
overlayEl.addEventListener("click", () => {
  beginIfNeeded();
});

// unit aim direction from the player toward the mouse (or facing, if no mouse)
function currentAim() {
  const p = state.player;
  const ox = p.x + p.w / 2, oy = p.y + p.h / 2;
  let ax = state.mouse.cx - ox, ay = state.mouse.cy - oy;
  if (!state.mouse.active || (ax === 0 && ay === 0)) { ax = state.facing; ay = 0; }
  const l = Math.hypot(ax, ay) || 1;
  return { x: ax / l, y: ay / l };
}

// fire a portal (0 = blue, 1 = orange) toward the current aim
function fire(which) {
  if (!state.hasGun || state.mode !== "play") return;
  const p = state.player;
  const ox = p.x + p.w / 2, oy = p.y + p.h / 2;
  const a = currentAim();
  const ok = firePortal(which, ox + a.x * 1.2 * SCALE, oy + a.y * 1.2 * SCALE, a.x, a.y);
  if (ok) { state.fireFlash = 0.18; state.fireWhich = which + 1; }
}

screenEl.addEventListener("contextmenu", (e) => e.preventDefault());
screenEl.addEventListener("mousedown", (e) => {
  e.preventDefault();
  screenEl.focus();
  if (state.mode === "start") { startGame(); return; }
  if (state.mode !== "play" || !state.hasGun) return;
  updateMouseCell(e);
  // right-click OR shift-click = orange (trackpad friendly); plain click = blue
  fire(e.button === 2 || e.shiftKey ? 1 : 0);
});

function tryGrab() {
  if (state.grabCooldown > 0) return;
  const p = state.player, c = state.cube;
  if (state.carrying) {
    state.carrying = false;
    if (isCrouching()) {
      // crouch + E: throw the cube forward in an arc
      const dir = getThrowDirection();
      c.vx = dir * 10.625 * SCALE;
      c.vy = -24 * SCALE;
      c.x = p.x + p.w / 2 + dir * 2.6 * SCALE - c.w / 2;   // out in front
      c.y = p.y - 0.8 * SCALE;                             // from head height
      c.onGround = false;
      c.pcx = c.x + c.w / 2; c.pcy = c.y + c.h / 2;
    } else {
      // plain drop: straight down, no shove, so it stays put on the plate
      c.vx = 0; c.vy = 0;
    }
    state.grabCooldown = 0.25;
  } else {
    const dx = (c.x + c.w / 2) - (p.x + p.w / 2);
    const dy = (c.y + c.h / 2) - (p.y + p.h / 2);
    if (Math.hypot(dx, dy) <= GRAB_REACH) {
      state.carrying = true;
      state.grabCooldown = 0.25;
    }
  }
}

/* ------------------------------ 6. renderer ------------------------ */

// character buffer: chars[r][c], cls[r][c]
let chars = [], cls = [];
function resetBuffer() {
  chars = Array.from({ length: state.H }, () => Array(state.W).fill(" "));
  cls   = Array.from({ length: state.H }, () => Array(state.W).fill("bg"));
}
function put(x, y, ch, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= state.W || y < 0 || y >= state.H) return;
  chars[y][x] = ch; cls[y][x] = c;
}

const WALL_SHADE = "▓▒░▓▓▒";
function drawWorld() {
  const f = state.frame;
  for (let y = 0; y < state.H; y++) {
    for (let x = 0; x < state.W; x++) {
      const t = state.grid[y][x];
      if (t === "#") {
        const h = (x * 7 + y * 13) % WALL_SHADE.length;
        chars[y][x] = WALL_SHADE[h];
        cls[y][x] = (h % 3 === 1) ? "wall2" : "wall";
      } else if (t === "X") {
        if (x % 4 === 0 && y % 2 === 0) { chars[y][x] = "●"; cls[y][x] = "rivet"; }
        else { chars[y][x] = ((x + y) % 2 === 0) ? "▚" : "▞"; cls[y][x] = "metal"; }
      } else if (t === "~") {
        const w = "≈~≈-‗~";
        chars[y][x] = w[(x + Math.floor(f / 6)) % w.length];
        cls[y][x] = "water";
      } else if (t === "w") {
        const w = "≈~≈-‗~";
        chars[y][x] = w[(x + Math.floor(f / 6)) % w.length];
        cls[y][x] = "swim";
      } else if (t === "^") {
        chars[y][x] = (Math.floor(f / 6) % 2 === 0) ? "^" : "▲";
        cls[y][x] = "tramp";
      } else if (t === "_") {
        const on = state.doorOpen;
        chars[y][x] = on ? "▀" : "▄";
        cls[y][x] = on ? "plateOn" : "plate";
      } else if (t === "D") {
        chars[y][x] = " "; cls[y][x] = "bg";   // painted by drawDoor()
      } else {
        // air: sparse depth dots
        if ((x * 13 + y * 7) % 31 === 0) { chars[y][x] = "·"; cls[y][x] = "bg"; }
        else { chars[y][x] = " "; cls[y][x] = "bg"; }
      }
    }
  }
}

function drawPortals() {
  const styles = ["pa", "pb"];
  for (let i = 0; i < 2; i++) {
    const p = state.portals[i];
    if (!p) continue;
    const c = styles[i];
    const vertical = p.nx !== 0;         // portal lies on a vertical wall face
    // an oval mouth spanning the tangent, with rounded caps and a bright core
    for (let d = -PHALF_CELLS; d <= PHALF_CELLS; d++) {
      const mx = p.cx + p.tx * d, my = p.cy + p.ty * d;
      let ch;
      if (d === 0) ch = "◉";
      else if (Math.abs(d) === PHALF_CELLS) ch = vertical ? (d < 0 ? "╭" : "╰") : (d < 0 ? "╭" : "╮");
      else ch = vertical ? "(" : "~";
      put(mx, my, ch, c);
    }
  }
}

// multi-line sprite blitter
function blit(x, y, rows, c) {
  for (let r = 0; r < rows.length; r++)
    for (let k = 0; k < rows[r].length; k++) {
      const ch = rows[r][k];
      if (ch !== " ") put(x + k, y + r, ch, c);
    }
}

// draw the framed exit door across its stored rect (procedural so it adapts
// to any clamped size). Clearly bigger than the player, so it reads as a door.
function drawDoor() {
  const r = state.doorRect;
  if (!r) return;
  const open = state.doorOpen;
  const handleY = r.y + Math.floor(r.h / 2);
  for (let yy = 0; yy < r.h; yy++)
    for (let xx = 0; xx < r.w; xx++) {
      const gx = r.x + xx, gy = r.y + yy;
      const top = yy === 0, bot = yy === r.h - 1, left = xx === 0, right = xx === r.w - 1;
      let ch, cl = "door";
      if (top && left) ch = "▛";
      else if (top && right) ch = "▜";
      else if (bot && left) ch = "▙";
      else if (bot && right) ch = "▟";
      else if (top) ch = "▀";
      else if (bot) ch = "▄";
      else if (left) ch = "▌";
      else if (right) ch = "▐";
      else if (open) { ch = "░"; cl = "doorOpen"; }
      else if (gx === r.x + r.w - 2 && gy === handleY) ch = "●"; // handle
      else ch = ((xx + yy) % 2 === 0) ? "▓" : "▒";               // panel
      put(gx, gy, ch, cl);
    }
}

function drawCube() {
  const c = state.cube;
  const x = Math.round(c.x + c.w / 2 - 2.5);
  const y = Math.round(c.y + c.h / 2 - 2.5);
  blit(x, y, ["┌───┐",
              "│▓▓▓│",
              "│▓ ▓│",
              "│▓▓▓│",
              "└───┘"], "cube");
  put(x + 2, y + 2, "❤", "heart");
}

function drawPlayer() {
  const p = state.player;
  const art = state.carrying
    ? (isCrouching() ? ["█  █", " ██ ", "████"] : ["█  █", " ██ ", "████", " ██ ", "█  █"])
    : playerSpriteRows();
  const x = Math.round(p.x + p.w / 2 - 2);
  const y = Math.round(p.y + p.h) - art.length;   // anchor the FEET to the box bottom
  blit(x, y, art, "player");

  // in-world gun barrel tracking the aim (only if armed)
  if (state.hasGun) {
    const ox = p.x + p.w / 2, oy = p.y + p.h / 2 - 0.3 * SCALE;
    const ax = state.aim.x, ay = state.aim.y;
    const reach = 2.6 * SCALE;
    for (let s = 1.2 * SCALE; s <= reach; s += 1) {
      const ch = barrelChar(ax, ay, s > reach - 1);
      const c = state.fireFlash > 0 ? "flash" : "gun";
      put(ox + ax * s, oy + ay * s, ch, c);
    }
  }
}

function barrelChar(ax, ay, tip) {
  const ang = Math.atan2(ay, ax);
  const a = ((ang * 180) / Math.PI + 360) % 180;
  let base;
  if (a < 22 || a >= 158) base = "═";
  else if (a < 68) base = ay > 0 ? "╲" : "╱";
  else if (a < 112) base = "║";
  else base = ay > 0 ? "╱" : "╲";
  if (tip) {
    if (a < 22 || a >= 158) return ax >= 0 ? "►" : "◄";
    if (a < 112) return ay > 0 ? "▼" : "▲";
    return ay > 0 ? "▼" : "▲";
  }
  return base;
}

function render() {
  resetBuffer();
  drawWorld();
  drawDoor();
  drawPortals();
  drawCube();
  drawPlayer();

  // compose HTML with run-length grouping per row
  let html = "";
  for (let y = 0; y < state.H; y++) {
    let line = "", curCls = cls[y][0], run = "";
    for (let x = 0; x < state.W; x++) {
      const c = cls[y][x];
      if (c !== curCls) { line += span(curCls, run); run = ""; curCls = c; }
      run += esc(chars[y][x]);
    }
    line += span(curCls, run);
    html += line + "\n";
  }
  if (state.deathFlash > 0) {
    screenEl.style.filter = "hue-rotate(-40deg) brightness(1.4)";
  } else {
    screenEl.style.filter = "";
  }
  screenEl.innerHTML = html;
}

const span = (c, s) => s ? `<span class="t-${c}">${s}</span>` : "";
const esc = (ch) => ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch;

/* ---- side-panel HUD ---- */
function updateHud() {
  const def = LEVELS[state.levelIndex];
  syncChamberOptions();
  if (chamberSelect) chamberSelect.value = String(state.levelIndex);
  document.getElementById("hudHint").textContent = def.hint;
  const b = state.portals[0] ? "SET" : "—";
  const o = state.portals[1] ? "SET" : "—";
  document.getElementById("hudPortals").innerHTML =
    `PORTALS: <span style="color:var(--pa)">${b}</span> / <span style="color:var(--pb)">${o}</span>`;
  document.getElementById("hudCube").textContent = "CUBE: " + (state.carrying ? "carried" : "free");
  document.getElementById("hudPlate").textContent = "PLATE: " + (state.doorOpen ? "PRESSED — door open" : "open");
}

const GUN_ART = [
  "        ______",
  "       /  __  \\____",
  "   ___/  /  \\  \\   \\___",
  "  |___   | () |   ___  >==",
  "      \\  \\ __ /  /   \\/",
  "       \\__|  |__/",
  "          |==|",
  "          |  |",
  "         /____\\",
];
function drawGunView() {
  if (!state.hasGun) { gunViewEl.textContent = "  ( acquired in Chamber 02 )"; gunViewEl.className = "gunView"; return; }
  gunViewEl.textContent = GUN_ART.join("\n");
  gunViewEl.className = "gunView" + (state.fireFlash > 0 ? (state.fireWhich === 1 ? " fa" : " fb") : "");
}

/* ------------------------------ 7. game flow ----------------------- */

function showOverlay(text) { overlayTxt.textContent = text; overlayEl.classList.remove("hidden"); }
function hideOverlay() { overlayEl.classList.add("hidden"); }

// Center each line of a text block on one shared axis by padding it
// symmetrically to the widest line. Lines are authored without leading
// indentation (except the logo rows, whose leading spaces are part of the
// letterforms), and the logo rows are equal width so they stay stacked.
const centerLines = (lines) => {
  const w = Math.max(...lines.map((l) => l.length));
  return lines.map((l) => " ".repeat(Math.round((w - l.length) / 2)) + l);
};

const TITLE = centerLines([
  "",
  "█████ ███████ ██████ ██ ██     ██████   ██████  ██████ ████████ █████ ██    ",
  "██  █ ██      ██     ██ ██     ██   ██ ██    ██ ██   ██   ██    ██  █ ██    ",
  "█████ ███████ ██     ██ ██     ██████  ██    ██ ██████    ██    █████ ██    ",
  "██  █      ██ ██     ██ ██     ██      ██    ██ ██  ██    ██    ██  █ ██    ",
  "██  █ ███████ ██████ ██ ██     ██       ██████  ██   ██   ██    ██  █ ██████",
  "",
  "A P E R T U R E   S C I E N C E   —   1 0   C H A M B E R S",
  "",
  "",
  "« click here or press any key to begin »",
  "",
]);

function startGame() {
  state.mode = "play";
  state.hasGun = false;
  document.body.classList.remove("booting"); // reveal game screen + panel
  loadLevel(0);
  hideOverlay();
  screenEl.focus();
}

function completeLevel() {
  const wasFirst = state.levelIndex === 0;
  if (state.levelIndex >= LEVELS.length - 1) {
    state.mode = "won";
    showOverlay([
      "", "", "        ╔══════════════════════════════════════╗",
      "        ║   ALL TEST CHAMBERS COMPLETE             ║",
      "        ║                                          ║",
      "        ║   The cake, regrettably, is a lie.       ║",
      "        ║                                          ║",
      "        ║   press R-key... just kidding. Reload    ║",
      "        ║   the page to run the gauntlet again.    ║",
      "        ╚══════════════════════════════════════╝",
    ].join("\n"));
    return;
  }
  if (wasFirst) {
    state.hasGun = true;
    state.mode = "reward";
    state.overlayTimer = 3.0;
    showOverlay([
      "", "",
      "        ┌───────────────────────────────────────┐",
      "        │   HANDHELD PORTAL DEVICE  ACQUIRED     │",
      "        │                                        │",
      "        │      ______                            │",
      "        │     /  __  \\____                       │",
      "        │  __/  / () \\  \\  \\___                   │",
      "        │ |__   |    |   ___ >==   speedy thing   │",
      "        │    \\__| __ |__/          goes in...     │",
      "        │                                        │",
      "        │  Click/Q = BLUE   Shift-Click/F = ORANGE   │",
      "        └───────────────────────────────────────┘",
    ].join("\n"));
  } else {
    state.mode = "loading";
    state.overlayTimer = 1.6;
  }
}

function advance() {
  loadLevel(state.levelIndex + 1);
  state.mode = "play";
  hideOverlay();
}

function killPlayer() {
  state.deathFlash = 0.35;
  loadLevel(state.levelIndex);
}

/* ------------------------------ main loop -------------------------- */

let acc = 0, last = performance.now();

function frame(now) {
  let dtReal = (now - last) / 1000;
  if (dtReal > 0.1) dtReal = 0.1;
  last = now;

  // aim from mouse
  if (state.player) {
    const p = state.player;
    const ox = p.x + p.w / 2, oy = p.y + p.h / 2;
    let ax = state.mouse.cx - ox, ay = state.mouse.cy - oy;
    if (!state.mouse.active || (ax === 0 && ay === 0)) { ax = state.facing; ay = 0; }
    const l = Math.hypot(ax, ay) || 1;
    state.aim.x = ax / l; state.aim.y = ay / l;
  }

  if (state.mode === "play") {
    acc += dtReal;
    let steps = 0;
    while (acc >= DT && steps < 20) { step(DT); acc -= DT; steps++; }
  } else if (state.mode === "loading" || state.mode === "reward") {
    state.overlayTimer -= dtReal;
    if (state.overlayTimer <= 0) advance();
  }

  if (state.fireFlash > 0) state.fireFlash -= dtReal;
  if (state.deathFlash > 0) state.deathFlash -= dtReal;

  if (state.mode !== "start" && state.mode !== "won" && state.grid.length) render();
  drawGunView();
  state.frame++;
  requestAnimationFrame(frame);
}

function step(dt) {
  const p = state.player;
  if (state.grabCooldown > 0) state.grabCooldown -= dt;

  syncPlayerCrouch();

  // horizontal control
  const move = getHorizontalMove();
  if (move !== 0) {
    state.facing = move;
    state.lastMoveDir = move;
  }
  p.vx = move * MOVE_SPD;

  // jump — or swim upward while submerged in safe water
  const up = keys["w"] || keys[" "] || keys["arrowup"];
  if (up && inSwim(p)) {
    p.vy = -SWIM_UP;
  } else if (up && p.onGround) {
    p.vy = -JUMP_VEL; p.onGround = false;
  }

  moveBody(p, dt);

  // cube: carried follows the player, else free physics
  const c = state.cube;
  if (state.carrying) {
    const tx = p.x + p.w / 2 + state.facing * 1.6 * SCALE - c.w / 2;
    const ty = p.y - 0.2 * SCALE;
    c.vx = 0; c.vy = 0;
    c.x = tx; c.y = ty;
    c.pcx = c.x + c.w / 2; c.pcy = c.y + c.h / 2;
  } else {
    moveBody(c, dt);
  }

  // hazards
  if (inWater(p) || p.y > state.H + 3) { killPlayer(); return; }
  if (!state.carrying && (inWater(c) || c.y > state.H + 3)) {
    // lost cube -> restart chamber
    killPlayer(); return;
  }

  // plate / door
  const pressed = platePressed();
  if (pressed !== state.doorOpen) { state.doorOpen = pressed; updateHud(); }

  // win: player overlaps an open door
  if (state.doorOpen) {
    for (const d of state.doorCells) {
      if (p.x < d.x + 1 && p.x + p.w > d.x && p.y < d.y + 1 && p.y + p.h > d.y) {
        completeLevel();
        return;
      }
    }
  }
  updateHud();
}

/* ------------------------------ boot ------------------------------- */

// Monospace glyphs are taller than they are wide, so a "square" of N x N
// characters renders as a tall rectangle. Measure the font's real character
// advance width and set the grid's line-height to match, so every cell is
// square and cubes/player/portals get true proportions.
function squareUpCells() {
  try {
    const probe = document.createElement("span");
    probe.textContent = "0".repeat(100);
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
    screenEl.appendChild(probe);
    const cw = probe.getBoundingClientRect().width / 100;
    screenEl.removeChild(probe);
    if (cw > 0) screenEl.style.lineHeight = cw + "px";
  } catch (e) { /* no DOM to measure (e.g. headless) — keep CSS default */ }
}
// Square cells disabled for now — uncomment these two lines to re-enable the
// true-square look (measures the font and tightens line-height to match).
// squareUpCells();
// window.addEventListener("resize", squareUpCells);

// Chamber selector: jump only to chambers you've already reached. Chambers 2+
// grant the gun (loadLevel handles that), so warping arms you correctly.
function jumpToChamber(i) {
  if (i < 0 || i > state.maxReached) return;   // can't skip ahead of your progress
  document.body.classList.remove("booting");
  loadLevel(i);
  state.mode = "play";
  hideOverlay();
  if (screenEl.focus) screenEl.focus();
}

// (re)populate the dropdown with only the reached chambers; cheap no-op unless
// the unlocked count changed.
let chamberOptionsBuilt = -1;
function syncChamberOptions() {
  if (!chamberSelect || typeof document.createElement !== "function") return;
  if (chamberOptionsBuilt === state.maxReached) return;
  chamberOptionsBuilt = state.maxReached;
  while (chamberSelect.firstChild) chamberSelect.removeChild(chamberSelect.firstChild);
  for (let i = 0; i <= state.maxReached; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = LEVELS[i].name;
    chamberSelect.appendChild(opt);
  }
}
function buildChamberSelect() {
  if (!chamberSelect) return;
  syncChamberOptions();
  chamberSelect.addEventListener("change", () => jumpToChamber(parseInt(chamberSelect.value, 10)));
  // keep dropdown navigation (arrows, etc.) from also driving the player
  chamberSelect.addEventListener("keydown", (e) => e.stopPropagation());
}
buildChamberSelect();

document.body.classList.add("booting"); // title-only until the game starts
showOverlay(TITLE.join("\n"));
drawGunView();
requestAnimationFrame(frame);
