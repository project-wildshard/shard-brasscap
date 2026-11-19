#!/usr/bin/env node
// TEMPLATE-E2E TC-B0 (J357): Brasscap's play probe. One headless, muted Chromium page enters Brasscap Mesa the two ways a
// player does, by its Shard Select card and by the grid road into its cell (-1, -1) (and `--entry=chunk`, the one-shard page), and prints JSON: where the player
// stands (and how far from the depot porch and its rifle rack), the held item and its rounds, the hotbar, the creatures
// alive within 60 m with their hp and brain (the regional world's), the creature bodies the page draws (`bodies`: a grid
// cell's skinned meshes, shown and in the camera's view, by look), the quest step, the flags and the coins. Steps (`--do`) then act on the world
// by real input (keys and the mouse) and read again after each, so a content row's done-when is one line of this JSON.
//
//   node kit/scripts/play-probe.mjs [--staging | --base=<url>] [--entry=select|road|slug|chunk|both] [--layout=desktop|phone]
//     [--do=<step>,<step>...] [--out=<dir>] [--seconds=<budget>] [--browser=chromium|webkit]
//
// Steps: `gun:<species>@<h>@<range>@<leash>@<s>` (fire at a wire row until it dies), `pack:<species>@<reach>@<s>@<count>@<leash>` (hunt a roaming pack until this player holds <count> of its `dead:` flags), `watch:<species>@<s>` (the wire brain state of the nearest one), `device` (the identity and save databases), `refresh` (the same tab again), `reopen` (a new tab), `wait:<s>`, `find:<name>` (drawn objects by name, with world positions), `face:<x>,<z>[,<y>]` (and pitch to height y), `shot:<name>` (a screenshot), `fire[:<n>]` (left click n times, one cycle apart), `reload`, `slot:<n>` (press digit n), `use` (E),
// `aim:<creature kind>` (turn to face the nearest one alive), `walk:<x>,<z>[,<stop>]` (hold W toward a point of the cell's frame, to within <stop> m, default 2),
// `kill:<creature kind>[@<aim height>]` (walk within 25 m, aim and fire until it dies or 45 s pass; 8 hits with no kill mark a drawn corpse, skipped after), `shoot:<kind>` (aim, then fire once).
// Default site: a local preview at http://127.0.0.1:5173 (`--base`); `--staging` is https://staging.wildshard.io. Never
// production (J205): a join is a write. Chromium runs headless, muted, capped at 60 fps, and the page closes at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, webkit } from '../../scripts/browser-playwright.mjs';
import { saveFixture } from '@wildshard/engine/scripts/debug-settings.mjs';

const flag = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = (process.argv.includes('--staging') ? 'https://staging.wildshard.io' : flag('base', 'http://127.0.0.1:5173')).replace(/\/$/u, '');
if (!/^https:\/\/(staging|preview)\.wildshard\.io$|^http:\/\/(127\.0\.0\.1|localhost):\d+$/u.test(base)) throw new Error('play-probe joins local, preview or staging only, never production (J205)');
const entries = flag('entry', 'both') === 'both' ? ['select', 'road'] : flag('entry', 'select').split(',');
const phone = flag('layout', 'desktop') === 'phone';
const steps = flag('do', '').split(';').flatMap((part) => part.split(/,(?![\d.-])/u)).filter(Boolean);
const out = resolve(flag('out', join('tmp', 'play-probe')));
const budget = Number(flag('seconds', '420')) * 1000;
mkdirSync(out, { recursive: true });

/** Brasscap's cell on the grid catalogue, its card, and its places in the shard's own frame. */
const CELL = flag('cell', 'blender-template'), CARD = flag('card', 'Brasscap Mesa'), SLUG = flag('slug', 'brasscap-mesa');
/** `--porch=x,z` and `--spawn=x,z` move the two reference points for another shard (with its `--slug=` and `--cell=`). */
const xz = (text) => { const [x, z] = text.split(',').map(Number); return { x, z }; };
const PORCH = xz(flag('porch', '-2.2,-0.92')), SPAWN = xz(flag('spawn', '-1.6,2.6'));
/** `--fields=<row>,<row>`: wire rows read on every report (a boss's tell and core fields). */
const FIELDS = flag('fields', '').split(',').filter(Boolean);
/** The chrome a review page would also pass (scripts/chromium-keychain.mjs in engine), muted. Headless Chromium draws at its
 *  60 Hz begin-frame clock: the probe never asks for more (no vsync or frame-rate flags). */
const ARGS = ['--use-mock-keychain', '--password-store=basic', '--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'];
const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** The creature bodies the page draws: a grid cell's (data or bound) creatures are `neighbour-creature:<look>` skinned meshes in
 *  its cell root (engine `grid/neighbourLife.ts`), not the regional world's `state().creatures`. `shown` is visible up its whole
 *  parent chain; `inView` is shown and inside the camera's frustum. Positions are the cell root's own frame, as the player's.
 *  Runs in the page: `install` puts it on `window.__probeBodies` after entry. */
function drawnBodies(world, pos) {
  const scene = world?.game?.scene, cam = world?.game?.camera;
  if (scene === undefined || cam === undefined) return null;
  const rows = [];
  scene.traverse((o) => {
    if (typeof o.name !== 'string' || !o.name.startsWith('neighbour-creature:')) return;
    let shown = true; for (let p = o; p !== null; p = p.parent) if (!p.visible) { shown = false; break; }
    const ndc = o.position.clone().setFromMatrixPosition(o.matrixWorld).project(cam);
    const at = { x: o.position.x, y: o.position.y, z: o.position.z };
    rows.push({ skin: o.name.slice('neighbour-creature:'.length), shown, inView: shown && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1,
      pos: at, d: Math.round(Math.hypot(at.x - pos.x, at.z - pos.z) * 10) / 10 });
  });
  return rows;
}

/** The live creatures the server sends this page, by species (or wire kind): handle, place, hp. Runs in the page. */
function liveRows(species) {
  const net = /** @type {any} */ (window).__workerClientNet?.(), client = net?.client, latest = client?.latest;
  if (latest === null || latest === undefined) return [];
  const out = [];
  for (const [handle, info] of client.entities) {
    // a species, a wire kind, or a creature id prefix (`bandit.camp-3`: one camp's bodies, not the rushers roaming past it)
    if (info.cls?.cls !== 'animal' || (info.initial?.species !== species && info.initial?.kind !== species && !String(info.id ?? '').endsWith(species) && !String(info.id ?? '').includes(`${species}.`))) continue;
    const f = client.fields(latest, handle);
    if (f !== null && Boolean(f.alive)) out.push({ handle, id: String(info.id ?? ''), x: Number(f.x), y: Number(f.y), z: Number(f.z), hp: Number(f.hp), state: f.state ?? null });
  }
  return out;
}

const install = (page) => page.evaluate(`window.__probeBodies = ${drawnBodies.toString()}; window.__probeLive = ${liveRows.toString()}`);

/** Everything the probe reads, in the page. The cell's frame: on a grid page the player's position is the cell's own. */
function read({ porch, spawn, fields = [] }) {
  const W = /** @type {any} */ (window), P = W.__wildshard, world = P?.world;
  if (world === undefined) return { error: 'no world' };
  const st = P.state(), area = P.area?.() ?? null, grid = P.shard?.grid?.state?.() ?? null, pos = st.player.pos;
  const eq = world.weapons, held = eq.current;
  const gun = (w) => ({ id: w.id, has: typeof eq.has === 'function' ? eq.has(w.id) : null, taken: w.taken ?? null, rounds: w.act?.rounds ?? w.state?.magazine ?? null,
    reserve: w.store?.reserve ?? w.state?.reserve ?? null });
  const near = st.creatures.map((c) => ({ ...c, d: Math.round(Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) * 10) / 10 })).filter((c) => c.d <= 60 && c.hp > 0);
  const kinds = {}; for (const c of near) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
  const wire = W.__workerClient?.();
  const bodies = W.__probeBodies?.(world, pos) ?? null;
  return {
    inside: grid?.inside ?? area?.instance ?? null, slug: area?.slug ?? null, appState: st.appState,
    pos: { x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100, z: Math.round(pos.z * 100) / 100 }, hp: st.player.health,
    fromPorch: Math.round(Math.hypot(pos.x - porch.x, pos.z - porch.z) * 10) / 10, fromSpawn: Math.round(Math.hypot(pos.x - spawn.x, pos.z - spawn.z) * 10) / 10,
    held: { ...gun(held), state: st.weapon.state }, hotbar: (eq.list ?? []).map(gun),
    creatures: { within60: near.length, kinds, all: st.creatures.length, allAlive: st.creatures.filter((c) => c.hp > 0).length,
      rows: near.slice(0, 24).map((c) => ({ kind: c.kind, hp: Math.round(c.hp * 10) / 10, d: c.d, brain: c.brain })) },
    bodies: bodies === null ? null : { drawn: bodies.filter((b) => b.shown).length, inView: bodies.filter((b) => b.inView).length,
      bySkin: bodies.reduce((by, b) => (b.shown ? { ...by, [b.skin]: (by[b.skin] ?? 0) + 1 } : by), {}),
      inViewBySkin: bodies.reduce((by, b) => (b.inView ? { ...by, [b.skin]: (by[b.skin] ?? 0) + 1 } : by), {}),
      within60: bodies.filter((b) => b.shown && b.d <= 60).length, life: grid?.life ?? null },
    quest: wire?.quests ?? st.quest, flags: wire?.flags ?? area?.flags ?? [], coins: wire?.paid ?? null, owned: wire?.owned ?? null,
    wire: wire === undefined ? null : { rows: wire.rows, drawn: wire.drawn, hits: wire.hits, kills: wire.kills, hp: wire.hp, fights: wire.fights, cell: wire.cell },
    prompt: world.hud?.promptText ?? null, frames: wire?.frames ?? null, fights: wire?.fights ?? null,
    save: wire === undefined ? null : { restored: wire.restored, savedTick: wire.savedTick, savedOk: wire.savedOk, closed: wire.closed, own: wire.own },
    fields: Object.fromEntries(fields.map((name) => [name, W.__workerClientRow?.(name) ?? null])),
    talk: document.querySelector('.ws-quest-talk.show .ws-quest-talk-name')?.textContent ?? null,
    // TC-B10: the health bars on screen (engine ui/Combat.ts): each shown bar's label and its fill, and the damage numbers up
    bars: [...document.querySelectorAll('.ws-combat-hp.show')].map((el) => ({ label: el.querySelector('.ws-combat-hp-kind')?.textContent ?? '',
      fill: Number(/scaleX\(([\d.]+)\)/u.exec(el.querySelector('.ws-combat-hp-fill')?.style.transform ?? '')?.[1] ?? 1), dead: el.classList.contains('dead') })),
    floats: [...document.querySelectorAll('.ws-combat-float.show')].map((el) => el.textContent ?? ''),
  };
}

async function enter(page, how) {
  await page.goto(`${base}/?mute=1&nolock=1${how === 'chunk' ? `&skipintro&chunk=${CELL}` : ''}`, { waitUntil: 'load', timeout: 120_000 });
  if (how === 'chunk') return await ready(page, Date.now());
  if (how === 'slug') return await slugIn(page);
  await page.locator('.ws-main-select').waitFor({ state: 'visible', timeout: 120_000 });
  const dismiss = page.locator('#wsdrop .dismiss'); if (await dismiss.count() > 0) await dismiss.click();
  await page.locator('.ws-main-select').click();
  if (await page.locator('#ws-name-box input').waitFor({ timeout: 10_000 }).then(() => true).catch(() => false)) {
    await page.locator('#ws-name-box [data-name=skip]').click().catch(async () => { await page.locator('#ws-name-box button[type=submit]').click(); });
  }
  await page.locator('.ws-menu-card').first().waitFor({ state: 'visible', timeout: 30_000 });
  await sleep(600);
  // The road entry starts in Brasscap's north neighbour, Signal Dunes (-1, 0), and walks south across the line.
  const card = how === 'select' ? flag('card', CARD) : 'Signal Dunes';
  const index = await page.evaluate((name) => [...document.querySelectorAll('.ws-menu-card')].findIndex((row) => (row.textContent ?? '').includes(name)), card);
  if (index < 0) throw new Error(`No ${card} card in Shard Select`);
  await page.locator('.ws-menu-dots i').nth(index).click(); await sleep(500);
  const t0 = Date.now();
  await page.locator('.ws-menu-play').click();
  return await ready(page, t0);
}

/** `--entry=slug`: the shard's own page, `/slug/<slug>`, whose deck holds its one card (the Shard Select card can be hidden). */
async function slugIn(page) {
  await page.goto(`${base}/slug/${SLUG}?mute=1&nolock=1`, { waitUntil: 'load', timeout: 120_000 });
  const dismiss = page.locator('#wsdrop .dismiss'); if (await dismiss.count() > 0) await dismiss.click();
  const main = page.locator('.ws-main-select');
  if (await main.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)) await main.click();
  if (await page.locator('#ws-name-box input').waitFor({ timeout: 10_000 }).then(() => true).catch(() => false)) {
    await page.locator('#ws-name-box [data-name=skip]').click().catch(async () => { await page.locator('#ws-name-box button[type=submit]').click(); });
  }
  const play = page.locator('.ws-menu-play'); await play.waitFor({ state: 'visible', timeout: 60_000 }); await sleep(600);
  if (await play.isDisabled()) throw new Error(`The ${SLUG} page's Play is disabled: ${await page.locator('.ws-menu-play small').textContent()}`);
  const t0 = Date.now(); await play.click();
  // the slug page asks the player's name after Play, not before
  if (await page.locator('#ws-name-box input').waitFor({ timeout: 10_000 }).then(() => true).catch(() => false)) {
    await page.locator('#ws-name-box [data-name=skip]').click().catch(async () => { await page.locator('#ws-name-box button[type=submit]').click(); });
  }
  return await ready(page, t0);
}

/** Control: the world's player, the server's frames, and on a grid page its live cell gameplay-ready. */
async function ready(page, t0) {
  await page.waitForFunction(() => {
    const W = /** @type {any} */ (window), grid = W.__wildshard?.shard?.grid, wire = W.__workerClient?.();
    if (W.__wildshard?.world?.player === undefined || (wire?.frames ?? 0) < 20) return false;
    if (grid === undefined) return true;
    const st = grid.state(); return st.live?.live?.gameplayReady === true && typeof st.inside === 'string';
  }, undefined, { timeout: 180_000, polling: 250 });
  const ms = Date.now() - t0;
  await sleep(1500);
  await page.getByText('DONE', { exact: true }).click({ timeout: 2000 }).catch(() => undefined);
  return ms;
}

const pose = (page) => page.evaluate(() => { const p = /** @type {any} */ (window).__wildshard.world.player; return { x: p.position.x, z: p.position.z, yaw: p.yaw }; });
/** Face (x, z) in the cell's frame: the page's motor faces atan2(own - target). */
const face = async (page, x, z, pitch = 0) => {
  const at = await pose(page);
  await page.evaluate(([yaw, p]) => { const pl = /** @type {any} */ (window).__wildshard.world.player; pl.yaw = yaw; pl.pitch = p; }, [Math.atan2(at.x - x, at.z - z), pitch]);
  return Math.hypot(at.x - x, at.z - z);
};

/** Hold W (and Shift) toward (x, z) until within `stop` m, jumping when stuck. */
async function walk(page, x, z, stop = 2, ms = 90_000) {
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  let near = Infinity, stuck = 0, before = await pose(page);
  try {
    for (const ends = Date.now() + ms; Date.now() < ends && near > stop; await sleep(200)) {
      near = await face(page, x, z);
      const now = await pose(page);
      if (Math.hypot(now.x - before.x, now.z - before.z) >= 0.15) stuck = 0; else if (++stuck % 5 === 0) await page.keyboard.press('Space');
      before = now;
    }
  } finally { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
  return near;
}

/** The nearest live creature of a kind, in the cell's frame: the regional world's, else (a grid cell) the nearest drawn body
 *  whose look names the kind (`body: true`; its life is read from the page's kills, not its hp). */
const nearest = (page, kind, corpses = []) => page.evaluate(([k, skip]) => {
  const W = /** @type {any} */ (window), st = W.__wildshard.state(), p = st.player.pos;
  const rows = st.creatures.filter((c) => c.hp > 0 && (c.kind === k || c.id.startsWith(k))).map((c) => ({ ...c, d: Math.hypot(c.pos.x - p.x, c.pos.z - p.z) }));
  if (rows.length === 0) {
    for (const b of W.__probeBodies?.(W.__wildshard.world, p) ?? []) {
      if (!b.shown || !b.skin.includes(k) || skip.some((c) => Math.hypot(c.x - b.pos.x, c.z - b.pos.z) < 1)) continue;
      rows.push({ id: `${b.skin}@${Math.round(b.pos.x)},${Math.round(b.pos.z)}`, kind: k, pos: b.pos, hp: 1, d: b.d, body: true });
    }
  }
  rows.sort((a, b) => a.d - b.d); return rows[0] ?? null;
}, [kind, corpses]);
/** A drawn body that took this many hits with no confirmed kill is taken for a corpse (a grid body carries no hp on the page). */
const CORPSE_SHOTS = 8;
const corpses = [];

/** Aim at a creature's body: yaw toward it, pitch toward its middle. */
async function aimAt(page, c, height = 0.9) {
  const at = await page.evaluate(() => /** @type {any} */ (window).__wildshard.state().player.pos);
  const d = Math.hypot(c.pos.x - at.x, c.pos.z - at.z);
  await face(page, c.pos.x, c.pos.z, Math.atan2(c.pos.y + height - (at.y + 1.68), Math.max(d, 0.1)));
}

async function fire(page, n = 1) {
  for (let i = 0; i < n; i++) { await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(760); }
}

async function step(page, name) {
  const [verb, arg = ''] = name.split(':');
  if (verb === 'wait') { await sleep(Number(arg) * 1000); return { verb }; }
  if (verb === 'fire') { await fire(page, Number(arg || 1)); return { verb }; }
  if (verb === 'reload') { await page.keyboard.press('KeyR'); await sleep(2500); return { verb }; }
  if (verb === 'slot') { await page.keyboard.press(`Digit${arg}`); await sleep(600); return { verb }; }
  if (verb === 'use') { await page.keyboard.press('KeyE'); await sleep(900); return { verb }; }
  if (verb === 'face') {
    // `face:x,z,y`: also pitch to the height y (the cell's metres) from the eye
    const [x, z, y] = arg.split(',').map(Number);
    if (y === undefined || Number.isNaN(y)) await face(page, x, z);
    else {
      const eye = await page.evaluate(() => { const W = /** @type {any} */ (window).__wildshard.world; return { y: W.game.camera.matrixWorld.elements[13], ...(({ x, z }) => ({ x, z }))(W.player.position) }; });
      await face(page, x, z, Math.atan2(y - eye.y, Math.hypot(x - eye.x, z - eye.z)));
    }
    await sleep(400); return { verb };
  }
  if (verb === 'find') {
    // `find:<name>`: the drawn objects whose name holds <name>, with their world positions (a mover's panel, a prop)
    const rows = await page.evaluate((name) => {
      const out = []; /** @type {any} */ (window).__wildshard.world.game.scene.traverse((o) => {
        if (typeof o.name !== 'string' || !o.name.includes(name)) return;
        const p = o.getWorldPosition(o.position.clone()), box = new p.constructor(), lo = p.clone(), hi = p.clone(); let any = false;
        o.traverse((m) => { if (m.geometry === undefined) return; m.geometry.computeBoundingBox?.(); const b = m.geometry.boundingBox; if (b === null || b === undefined) return; for (const c of [b.min, b.max]) { box.copy(c).applyMatrix4(m.matrixWorld); if (!any) { lo.copy(box); hi.copy(box); any = true; } else { lo.min(box); hi.max(box); } } });
        const r = (v) => Math.round(v * 100) / 100;
        out.push({ name: o.name, visible: o.visible, x: r(p.x), y: r(p.y), z: r(p.z), ...(any ? { minY: r(lo.y), maxY: r(hi.y) } : {}) });
      });
      return out.slice(0, 8);
    }, arg);
    return { verb, rows };
  }
  if (verb === 'shot') { await page.screenshot({ path: join(out, `${arg}.png`) }); return { verb }; }
  if (verb === 'walk') { const [x, z, stop = 2] = arg.split(',').map(Number); return { verb, near: Math.round(await walk(page, x, z, stop)) }; }
  if (verb === 'aim' || verb === 'shoot') {
    const c = await nearest(page, arg); if (c === null) return { verb, found: false };
    await aimAt(page, c); if (verb === 'shoot') await fire(page, 1);
    return { verb, found: true, d: Math.round(c.d) };
  }
  if (verb === 'kill') {
    // `kill:<kind>@<h>`: aim <h> m over its feet (default 0.9; a small body's hit volume sits lower than its drawn skin)
    const [kind = arg, h = '0.9'] = arg.split('@'), height = Number(h);
    const first = await nearest(page, kind, corpses); if (first === null) return { verb, found: false };
    const ends = Date.now() + 45_000; let shots = 0, onTarget = 0, target = first;
    const kills = () => page.evaluate(() => /** @type {any} */ (window).__workerClient?.()?.kills ?? 0), before = await kills();
    while (Date.now() < ends) {
      // a drawn body has no hp on the page: it is down when this page's confirmed kills grow (or no body of the kind is left)
      const killed = target.body === true && (await kills()) > before;
      const c = target.body === true ? (killed ? null : await nearest(page, kind, corpses))
        : await page.evaluate((id) => /** @type {any} */ (window).__wildshard.state().creatures.find((row) => row.id === id) ?? null, target.id);
      if (c === null || c.hp <= 0) return { verb, found: true, killed: killed || target.body !== true, shots, corpses: corpses.length };
      if (target.body === true) {
        if (Math.hypot(c.pos.x - target.pos.x, c.pos.z - target.pos.z) > 1) onTarget = 0;
        target = c;
        // shots into a body that never falls: a corpse still drawn where it died; aim at the next one
        if (onTarget >= CORPSE_SHOTS) { corpses.push({ x: c.pos.x, z: c.pos.z }); onTarget = 0; continue; }
      }
      const d = await page.evaluate((p) => { const at = /** @type {any} */ (window).__wildshard.state().player.pos; return Math.hypot(p.x - at.x, p.z - at.z); }, c.pos);
      if (d > 25) { await walk(page, c.pos.x, c.pos.z, 20, 15_000); continue; }
      const held = await page.evaluate(() => /** @type {any} */ (window).__wildshard.world.weapons.current?.state ?? null);
      if (held !== null && held.ammo === 0 && held.reserve > 0 && !held.reloading) { await page.keyboard.press('KeyR'); await sleep(2500); continue; }
      // aim down the sights (right button held): the lever's hip spread is 0.9, its sights' 0
      await aimAt(page, c, height); await page.mouse.down({ button: 'right' }); await sleep(250); await fire(page, 1); await page.mouse.up({ button: 'right' }); shots++; onTarget++;
    }
    return { verb, found: true, killed: false, shots, corpses: corpses.length };
  }
  if (verb === 'talk') {
    // `talk`: E at the speaker, then E through its lines; E on the last line takes the first choice the node offers
    await page.keyboard.press('KeyE'); await sleep(700);
    const said = [];
    for (let i = 0; i < 24; i++) {
      const box = await page.evaluate(() => { const el = document.querySelector('.ws-quest-talk.show'); return el === null ? null : { name: el.querySelector('.ws-quest-talk-name')?.textContent ?? '', text: el.querySelector('.ws-quest-talk-text')?.textContent ?? '', choices: [...el.querySelectorAll('.ws-quest-talk-choice')].map((c) => c.textContent ?? '') }; });
      if (box === null) break;
      if (said.at(-1)?.text !== box.text) said.push(box);
      await page.keyboard.press('KeyE'); await sleep(450);
    }
    await sleep(1200);
    return { verb, said: said.map((b) => `${b.name}: ${b.text.slice(0, 80)}${b.choices.length > 0 ? ` [${b.choices.join(' | ')}]` : ''}`) };
  }
  if (verb === 'melee') {
    // `melee:<kind>[@<reach>[@<leash>]]`: walk within reach of the nearest live <kind> (the wire's rows), face its middle, swing until it
    // dies or 60 s pass. A melee kit item strikes the body whose aim point is within its range of the look.
    // `@<leash>`: only bodies within that many metres of where the step began (a fleeing pack once led the probe 300 m off)
    const [kind = arg, r = '1.8', l = 'Infinity'] = arg.split('@'), reach = Number(r), leash = Number(l);
    const home = await page.evaluate(() => /** @type {any} */ (window).__wildshard.state().player.pos);
    const live = () => page.evaluate(([k, h, far]) => { const W = /** @type {any} */ (window), p = W.__wildshard.state().player.pos;
      return (W.__probeLive?.(k) ?? []).filter((c) => Math.hypot(c.x - h.x, c.z - h.z) <= far).map((c) => ({ ...c, d: Math.hypot(c.x - p.x, c.z - p.z) })).sort((a, b) => a.d - b.d); }, [kind, { x: home.x, z: home.z }, leash]);
    const first = await live(); if (first.length === 0) return { verb, found: false };
    // `kills`: this page's confirmed kills in the step (a body that only ran out of the leash or the wire's view is no kill)
    const kills = () => page.evaluate(() => /** @type {any} */ (window).__workerClient?.()?.kills ?? 0), before = await kills();
    const count = first.length, ends = Date.now() + 60_000; let swings = 0;
    while (Date.now() < ends) {
      const rows = await live(); if (rows.length < count) return { verb, found: true, killed: true, kills: (await kills()) - before, swings, left: rows.length };
      const c = rows[0];
      if (c.d > reach) { await walk(page, c.x, c.z, reach * 0.7, 6000); continue; }
      await aimAt(page, { pos: { x: c.x, y: c.y, z: c.z } }, 0.5);
      await page.mouse.down(); await sleep(60); await page.mouse.up(); swings++; await sleep(420);
    }
    return { verb, found: true, killed: false, swings };
  }
  if (verb === 'boss') { return { verb, ...(await boss(page, arg)) }; }
  if (verb === 'pack') { return { verb, ...(await pack(page, arg)) }; }
  if (verb === 'watch') {
    // `watch:<species>@<seconds>`: the brain state the server sends for the nearest live <species> (the wire row's `state`,
    // TC-NE24c), sampled every 300 ms while the probe stands; one line per change, with its distance and the player's hp
    const [kind = arg, sec = '20'] = arg.split('@'), log = [], seen = {}; let last = '';
    for (const ends = Date.now() + Number(sec) * 1000; Date.now() < ends; await sleep(300)) {
      const s = await page.evaluate((k) => { const W = /** @type {any} */ (window), p = W.__wildshard.state().player.pos, hp = W.__wildshard.state().player.health;
        const c = (W.__probeLive?.(k) ?? []).map((r) => ({ ...r, d: Math.hypot(r.x - p.x, r.z - p.z) })).sort((a, b) => a.d - b.d)[0] ?? null;
        return c === null ? null : { id: c.id, state: c.state, d: Math.round(c.d * 10) / 10, hp }; }, kind);
      if (s === null) continue;
      seen[String(s.state)] = (seen[String(s.state)] ?? 0) + 1;
      const line = `${s.id} ${String(s.state)}`; if (line !== last) { last = line; log.push(`${line} d${s.d} hp${Math.round(s.hp)}`); }
    }
    return { verb, seen, log: log.slice(0, 40) };
  }
  if (verb === 'gun') {
    // `gun:<species>[@<aim height>[@<range>[@<leash>[@<seconds>]]]]`: the nearest live <species> on the wire (within <leash> m of
    // where the step began) is followed by its handle: walk within <range> m, aim down the sights at <aim height> over its feet and
    // fire until the wire says it is dead, reloading as needed. Unlike `kill`, which aims at a drawn body, this reads the server's row.
    // `@<open row>` (sixth): fire only while that wire row is set (the Dust Wyrm's `brasscap.wyrm-gullet`, its glowing weak point),
    // and hold fire, without counting toward the stuck guard, while it is not. With no open row, hold while the body is under
    // ground. The row alone gates a named weak point: the Wyrm rests at y -1.29 in its mound, which the old y gate took for
    // burrowed, so the probe held fire through every open gullet (TC-SHIP-d2, opus-te2e5). `opens` counts the row's openings.
    const [kind = arg, h = '0.9', rg = '20', l = 'Infinity', sec = '60', open = ''] = arg.split('@'), height = Number(h), range = Number(rg), leash = Number(l);
    let waits = 0, opens = 0, wasOpen = false; const rowLog = [];
    const home = await page.evaluate(() => /** @type {any} */ (window).__wildshard.state().player.pos);
    const live = () => page.evaluate(([k, at, far]) => { const W = /** @type {any} */ (window), p = W.__wildshard.state().player.pos;
      return (W.__probeLive?.(k) ?? []).filter((c) => Math.hypot(c.x - at.x, c.z - at.z) <= far).map((c) => ({ ...c, d: Math.hypot(c.x - p.x, c.z - p.z) })).sort((a, b) => a.d - b.d); }, [kind, { x: home.x, z: home.z }, leash]);
    const kills = () => page.evaluate(() => /** @type {any} */ (window).__workerClient?.()?.kills ?? 0), before = await kills();
    const first = (await live())[0]; if (first === undefined) return { verb, found: false };
    const ends = Date.now() + Number(sec) * 1000; let shots = 0, reloads = 0, lowHp = 100, hpAt = first.hp, since = 0, seen = null;
    while (Date.now() < ends) {
      const c = (await live()).find((row) => row.handle === first.handle);
      if (c === undefined) return { verb, found: true, killed: true, target: first.handle, kills: (await kills()) - before, shots, reloads, lowHp, opens, rowLog };
      // a target out of the line of fire (a ledge row from below) once drained the whole reserve: 15 shots with no hit end the step
      if (c.hp < hpAt) { hpAt = c.hp; since = shots; } else if (shots - since >= 15) return { verb, found: true, killed: false, stuck: true, target: first.handle, at: [c.x, c.y, c.z], hp: c.hp, shots, reloads, lowHp };
      const held = await page.evaluate(() => { const W = /** @type {any} */ (window).__wildshard; return { ...(W.world.weapons.current?.state ?? {}), hp: W.state().player.health }; });
      lowHp = Math.min(lowHp, held.hp);
      if (held.hp <= 0) { await sleep(4000); continue; }
      if (c.d > range) { await walk(page, c.x, c.z, range * 0.8, 8000); continue; }
      const isOpen = open === '' ? c.y >= -0.5 : await page.evaluate((row) => Boolean(/** @type {any} */ (window).__workerClientRow?.(row)), open);
      if (open !== '' && isOpen !== wasOpen) { wasOpen = isOpen; if (isOpen) opens++; if (rowLog.length < 40) rowLog.push(`${((Date.now() - ends) / 1000 + Number(sec)).toFixed(1)}s ${open}=${isOpen ? 1 : 0} hp${c.hp} d${c.d.toFixed(1)}`); }
      if (!isOpen) { since = shots; waits++; await aimAt(page, { pos: { x: c.x, y: c.y, z: c.z } }, height); await sleep(200); continue; }
      // rounds left in the gun (`ammo`), not `magazine`, its capacity: a dry lever read 6 and kept firing blanks (TC-B9 d2)
      const rounds = typeof held.ammo === 'number' ? held.ammo : held.magazine;
      if (rounds === 0 && !held.reloading) { if ((held.reserve ?? 0) <= 0) return { verb, found: true, killed: false, dry: true, shots, reloads, lowHp }; await page.keyboard.press('KeyR'); reloads++; await sleep(2500); continue; }
      // lead a moving body (a charging rusher): its wire velocity over the last read, times the ~0.35 s from aim to the round
      const now = Date.now(), lead = seen !== null && now - seen.t < 1500 ? 0.35 / ((now - seen.t) / 1000) : 0;
      const ax = c.x + (seen === null ? 0 : (c.x - seen.x) * lead), az = c.z + (seen === null ? 0 : (c.z - seen.z) * lead); seen = { x: c.x, z: c.z, t: now };
      await aimAt(page, { pos: { x: ax, y: c.y, z: az } }, height); await page.mouse.down({ button: 'right' }); await sleep(250); await fire(page, 1); await page.mouse.up({ button: 'right' }); shots++;
    }
    return { verb, found: true, killed: false, target: first.handle, shots, reloads, lowHp, waits, opens, rowLog, hp: (await live()).find((row) => row.handle === first.handle)?.hp ?? null };
  }
  if (verb === 'device') {
    // `device`: who this page says it is (the device identity keys in localStorage) and the save databases it holds
    return { verb, ...(await page.evaluate(async () => {
      const ids = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) ?? ''; if (k.includes('identity')) ids[k] = JSON.parse(localStorage.getItem(k) ?? 'null')?.player ?? null; }
      const dbs = typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((d) => d.name) : null;
      // the solo server's saves (engine saves/indexed.ts): every key in each wildshard-saves store, its device id and its size
      const saves = {};
      for (const name of (dbs ?? []).filter((n) => n.startsWith('wildshard-saves'))) {
        saves[name] = await new Promise((done) => {
          const open = indexedDB.open(name); open.onerror = () => { done({ error: String(open.error) }); };
          open.onsuccess = () => {
            const db = open.result; if (!db.objectStoreNames.contains('saves')) { db.close(); done({ stores: [...db.objectStoreNames] }); return; }
            const rows = {}, cursor = db.transaction('saves').objectStore('saves').openCursor();
            cursor.onsuccess = () => { const c = cursor.result; if (c === null) { db.close(); done(rows); return; }
              const v = typeof c.value === 'string' ? c.value : JSON.stringify(c.value);
              rows[String(c.key)] = String(c.key).includes('identity') ? JSON.parse(v)?.player ?? v.slice(0, 80) : v.length; c.continue(); };
            cursor.onerror = () => { db.close(); done({ error: String(cursor.error) }); };
          };
        });
      }
      return { ids, keys: localStorage.length, dbs, saves, origin: location.origin };
    })) };
  }
  throw new Error(`No probe step ${name}`);
}

/** `pack:<species>@<reach>@<seconds>@<count>@<leash>`: a roaming pack, the way a player hunts one (the Template's mosslings for
 *  the Hermit's count, TC-SHIP-e2). Done when this player's flags hold <count> `dead:<species>:<n>` rows, the server's own kill
 *  credit (a body that only ran out of view is no kill: the old `melee` step counted those). Each turn picks the nearest live
 *  body whose `dead:` flag this player lacks, by its wire id, and chases it with no fixed leash (re-aimed every 1.5 s, so a
 *  circling pack is followed); a body past <leash> m from the step's start (default 120) is left. With none live in reach, the
 *  probe goes back to the start and stands: the pack is aggressive and comes in to bite, which brings it into reach. Swings
 *  at its middle when within <reach>; at under 35 hp it backs off to heal; a death waits out the respawn, then walks back. */
async function pack(page, arg) {
  const [kind = arg, r = '2', sec = '600', n = '4', l = '120'] = arg.split('@'), reach = Number(r), count = Number(n), leash = Number(l);
  const home = await page.evaluate(() => /** @type {any} */ (window).__wildshard.state().player.pos);
  const look = () => page.evaluate(([k, h, far]) => {
    const W = /** @type {any} */ (window), st = W.__wildshard.state(), p = st.player.pos, flags = W.__workerClient?.()?.flags ?? [];
    const mine = flags.filter((f) => f.startsWith(`dead:${k}:`));
    const key = (id) => /([\w.-]+:\d+)$/u.exec(id)?.[1] ?? id;
    const rows = (W.__probeLive?.(k) ?? []).filter((c) => Math.hypot(c.x - h.x, c.z - h.z) <= far && !mine.includes(`dead:${key(c.id)}`))
      .map((c) => ({ ...c, key: key(c.id), d: Math.hypot(c.x - p.x, c.z - p.z) })).sort((a, b) => a.d - b.d);
    return { rows, mine, hp: st.player.health, p, seen: (W.__probeLive?.(k) ?? []).length };
  }, [kind, { x: home.x, z: home.z }, leash]);
  const t0 = Date.now(), ends = t0 + Number(sec) * 1000, log = [];
  let swings = 0, chases = 0, waits = 0, heals = 0, deaths = 0, lowHp = 100, had = -1;
  while (Date.now() < ends) {
    const s = await look(); lowHp = Math.min(lowHp, s.hp);
    if (s.mine.length !== had) { had = s.mine.length; log.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${s.mine.join(' ') || 'none'} at ${Math.round(s.p.x)},${Math.round(s.p.z)}`); }
    if (s.mine.length >= count) return { found: true, done: true, mine: s.mine, swings, chases, waits, heals, deaths, lowHp, log };
    if (s.hp <= 0) { deaths++; await sleep(5000); await walk(page, home.x, home.z, 3, 60_000); continue; }
    if (s.hp < 35) { heals++; await walk(page, home.x, home.z, 3, 8000); await sleep(4000); continue; }
    const c = s.rows[0];
    if (c === undefined) {
      // none live and owed: stand at the start (the pack comes in), facing round so the page keeps their rows in view
      waits++; if (Math.hypot(s.p.x - home.x, s.p.z - home.z) > 4) await walk(page, home.x, home.z, 3, 20_000); else await sleep(1500);
      continue;
    }
    if (c.d > reach) { chases++; await walk(page, c.x, c.z, reach * 0.7, 1500); continue; }
    await aimAt(page, { pos: { x: c.x, y: c.y, z: c.z } }, 0.5);
    await page.mouse.down(); await sleep(60); await page.mouse.up(); swings++; await sleep(420);
  }
  const last = await look();
  return { found: true, done: false, mine: last.mine, seen: last.seen, swings, chases, waits, heals, deaths, lowHp, log };
}

/** `boss:<kind>@<reach>[@<aim height>]`: a told boss fight (the Template's Barrow Warden): stand off at about 0.8 x reach, sidestep
 *  while its ground ring is told (the first `--fields` row), strike while its core is open (the second), and back off to heal
 *  (health regenerates six seconds after the last hit) when hp is under 45. Ends when the boss dies or 300 s pass. */
async function boss(page, arg) {
  const [kind = arg, r = '5', h = '2.5'] = arg.split('@'), reach = Number(r), height = Number(h), standoff = reach * 0.75;
  const [tellRow, coreRow] = FIELDS;
  const look = () => page.evaluate(([k, tellName, coreName]) => {
    const W = /** @type {any} */ (window), st = W.__wildshard.state(), p = st.player.pos, wire = W.__workerClient?.();
    const b = (W.__probeLive?.(k) ?? [])[0] ?? null;
    return { boss: b, d: b === null ? null : Math.hypot(b.x - p.x, b.z - p.z), hp: st.player.health, p,
      tell: W.__workerClientRow?.(tellName) ?? 0, core: W.__workerClientRow?.(coreName) ?? 0, fights: wire?.fights ?? [], hits: wire?.hits ?? 0, flags: wire?.flags ?? [] };
  }, [kind, tellRow, coreRow]);
  const log = [], start = await look(); if (start.boss === null) return { found: false };
  const at = { x: start.boss.x, z: start.boss.z };
  let swings = 0, dodges = 0, heals = 0, deaths = 0, side = 1, lowHp = start.hp, lastFight = ''; const t0 = Date.now();
  const ends = Date.now() + Number(flag('bossSeconds', '300')) * 1000;
  while (Date.now() < ends) {
    const s = await look();
    // the timeline: one line whenever the boss's share, its tell or core, or this page's hits change
    const fight = `${s.fights.find((f) => /boss/u.test(f)) ?? s.fights.at(-1) ?? ''} t${s.tell} c${s.core} hits${s.hits}`;
    if (fight !== lastFight) { log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${fight} hp${Math.round(s.hp)} d${s.d?.toFixed(1)}`); lastFight = fight; }
    lowHp = Math.min(lowHp, s.hp);
    if (s.flags.includes(`dead:${kind}`) || s.boss === null) return { found: true, killed: true, swings, dodges, heals, deaths, lowHp, log };
    if (s.hp <= 0) { deaths++; await sleep(4000); await walk(page, at.x - standoff - 4, at.z, 2, 60_000); continue; }
    const away = { x: (s.p.x - s.boss.x) / Math.max(s.d, 0.1), z: (s.p.z - s.boss.z) / Math.max(s.d, 0.1) };
    if (s.hp < 45 && s.core !== 1) {
      // out of every strike's reach but inside the arena, sidestepping, until health climbs back
      heals++; await walk(page, s.boss.x + away.x * 7.5, s.boss.z + away.z * 7.5, 1, 5000);
      for (let t = 0; t < 40; t++) { const n = await look(); if (n.hp >= 85 || n.boss === null) break; await page.keyboard.down(side > 0 ? 'KeyD' : 'KeyA'); await sleep(400); await page.keyboard.up(side > 0 ? 'KeyD' : 'KeyA'); side = -side; await sleep(300); }
      continue;
    }
    if (s.tell === 1) {
      // the ring is told: circle the boss at the same distance (face it, strafe), out of the slam's spot and the stone's
      // line, so the core opens with the boss still in reach
      dodges++; side = -side;
      await page.keyboard.down('ShiftLeft'); await page.keyboard.down(side > 0 ? 'KeyD' : 'KeyA');
      for (let t = 0; t < 7; t++) { await face(page, s.boss.x, s.boss.z); await sleep(100); }
      await page.keyboard.up(side > 0 ? 'KeyD' : 'KeyA'); await page.keyboard.up('ShiftLeft');
      continue;
    }
    if (s.d > standoff + 0.4) { await walk(page, s.boss.x, s.boss.z, standoff, 2000); continue; }
    if (s.d < standoff - 1) { await face(page, s.boss.x, s.boss.z); await page.keyboard.down('KeyS'); await sleep(200); await page.keyboard.up('KeyS'); continue; }
    // in reach: swing (a shut core turns the blow away, so swinging early costs nothing and the first open frame lands)
    await aimAt(page, { pos: { x: s.boss.x, y: s.boss.y, z: s.boss.z } }, height);
    await page.mouse.down(); await sleep(60); await page.mouse.up(); swings++; await sleep(s.core === 1 ? 240 : 120);
  }
  return { found: true, killed: false, swings, dodges, heals, deaths, lowHp, log: log.slice(-120) };
}

/** The road entry: from Signal Dunes walk to its south edge, then south across the line into Brasscap's cell. */
async function roadIn(page) {
  const legs = [];
  const southYaw = 0; // facing -z
  await page.evaluate((yaw) => { /** @type {any} */ (window).__wildshard.world.player.yaw = yaw; }, southYaw);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  let last = await pose(page), stuck = 0, inside = null;
  const t0 = Date.now();
  try {
    for (const ends = Date.now() + 240_000; Date.now() < ends; await sleep(250)) {
      inside = await page.evaluate(() => /** @type {any} */ (window).__wildshard.shard?.grid?.state?.().inside ?? null);
      if (inside === CELL) break;
      await page.evaluate((yaw) => { /** @type {any} */ (window).__wildshard.world.player.yaw = yaw; }, southYaw);
      const now = await pose(page);
      if (Math.hypot(now.x - last.x, now.z - last.z) >= 0.15) stuck = 0;
      else if (++stuck % 4 === 0) { await page.keyboard.press('Space'); if (stuck % 12 === 0) legs.push({ stuckAt: { x: Math.round(now.x), z: Math.round(now.z) } }); }
      last = now;
    }
  } finally { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
  await page.waitForFunction(() => /** @type {any} */ (window).__wildshard?.shard?.grid?.state?.().live?.live?.gameplayReady === true, undefined, { timeout: 60_000 }).catch(() => undefined);
  await sleep(1500);
  return { inside, ms: Date.now() - t0, legs };
}

const report = { probe: 'brasscap play-probe', base, layout: phone ? 'phone 402x874' : 'desktop 1400x933', at: new Date().toISOString(), runs: [] };
// `--browser=webkit`: the iPhone's engine (Safari is WebKit), headless; it takes none of Chromium's flags (WebKit has no keychain prompt)
const engine = flag('browser', 'chromium'), browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, args: ARGS });
report.browser = engine;
const killer = setTimeout(() => { console.error('play-probe: over budget'); void browser.close().then(() => process.exit(2)); }, budget);
try {
  for (const how of entries) {
    const context = await browser.newContext(phone ? { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 933 } });
    // `--device=<id>`: this context's pages say they are that device (`device:<uuid>`), as a returning player's would
    if (flag('device', '') !== '') await context.addInitScript((id) => { try { if (localStorage.getItem('device:wildshard.save.v2.identity') === null) localStorage.setItem('device:wildshard.save.v2.identity', JSON.stringify({ player: id, name: 'Guest' })); } catch { /* no storage */ } }, flag('device', ''));
    await saveFixture(context, { scope: 'device', key: 'firstPlayDone', data: true });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    await saveFixture(context, { scope: 'global', key: 'settings', merge: true, data: { music: false, sfx: false, volume: 0, ...(phone ? { tier: 'phone' } : {}) } });
    let page = await context.newPage(); const errors = [], logs = [];
    // the page's own words about its seat, door and cell (`--logs=<regex>`, default door/seat/resume/regrid/save)
    const watchLog = (p) => { p.on('pageerror', (error) => { errors.push(error.message.slice(0, 200)); });
      // `--ws`: every socket's open, close and text frames (the door's control words), into the same log
      if (process.argv.includes('--ws')) p.on('websocket', (ws) => { logs.push(`ws open ${ws.url().replace(/\?.*$/u, '')}`); ws.on('close', () => { logs.push(`${new Date().toISOString().slice(11, 19)} ws close`); });
        let n = 0; ws.on('framereceived', (f) => { if (typeof f.payload === 'string' && n++ < 40) logs.push(`${new Date().toISOString().slice(11, 19)} ws in ${f.payload.slice(0, 200)}`); }); });
      p.on('console', (m) => { if (new RegExp(flag('logs', 'door|seat|resume|regrid|save|claim|ticket'), 'iu').test(m.text())) logs.push(`${new Date().toISOString().slice(11, 19)} ${m.type()} ${m.text().slice(0, 240)}`); }); };
    watchLog(page);
    const run = { entry: how };
    try {
      run.loadMs = await enter(page, how);
      await install(page);
      if (how === 'road') run.road = await roadIn(page);
      run.at = await page.evaluate(read, { porch: PORCH, spawn: SPAWN, fields: FIELDS });
      if (flag('eval', '') !== '') run.eval = await page.evaluate(flag('eval', '')).catch((error) => String(error));
      await page.screenshot({ path: join(out, `${how}-${phone ? 'phone' : 'desktop'}-enter.png`) }).catch(() => undefined);
      run.steps = [];
      for (const name of steps) {
        if (name === 'reopen' || name === 'refresh') {
          // `reopen`: a new tab in the same browser context (the same device save), entered the same way, read again;
          // `refresh`: the same tab loads the page again
          if (name === 'reopen') { await page.close(); page = await context.newPage(); watchLog(page); }
          const ms = await enter(page, how); await install(page);
          // TC-SHIP-e2 (opus-closer): the first read came at 130 frames, before the world's save reached the page (quest, flags and
          // owned all empty); read once the wire carries quest rows, or after 20 s
          // read once the wire carries quest rows and a cell, or after `--reopenWait` seconds (default 60), with a timeline
          let after = await page.evaluate(read, { porch: PORCH, spawn: SPAWN, fields: FIELDS }); const t0 = Date.now(), timeline = [];
          for (const until = t0 + Number(flag('reopenWait', '60')) * 1000; (Object.keys(after.quest ?? {}).length === 0 || !(after.wire?.cell > 0)) && Date.now() < until;) {
            timeline.push(`${((Date.now() - t0) / 1000).toFixed(1)}s cell${after.wire?.cell} rows${after.wire?.rows} frames${after.frames} own:${after.save?.own}`);
            await page.waitForTimeout(2000); after = await page.evaluate(read, { porch: PORCH, spawn: SPAWN, fields: FIELDS });
          }
          run.steps.push({ step: name, loadMs: ms, waitedMs: Date.now() - t0, timeline, device: (await step(page, 'device')), after });
          continue;
        }
        const did = await step(page, name);
        run.steps.push({ step: name, ...did, after: await page.evaluate(read, { porch: PORCH, spawn: SPAWN, fields: FIELDS }) });
      }
      if (steps.length > 0) await page.screenshot({ path: join(out, `${how}-${phone ? 'phone' : 'desktop'}-end.png`) }).catch(() => undefined);
    } catch (error) {
      run.error = String(error).slice(0, 300);
      await page.screenshot({ path: join(out, `${how}-${phone ? 'phone' : 'desktop'}-error.png`) }).catch(() => undefined);
    }
    run.errors = errors.slice(0, 8); run.logs = logs.slice(-60);
    report.runs.push(run);
    await context.close();
  }
} finally { clearTimeout(killer); await browser.close(); }
writeFileSync(join(out, 'probe.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
process.exit(report.runs.every((run) => run.error === undefined) ? 0 : 1);
