#!/usr/bin/env node
// TEMPLATE-E2E TC-B0 (J357): Brasscap's play probe. One headless, muted Chromium page enters Brasscap Mesa the two ways a
// player does, by its Shard Select card and by the grid road into its cell (-1, -1) (and `--entry=chunk`, the one-shard page), and prints JSON: where the player
// stands (and how far from the depot porch and its rifle rack), the held item and its rounds, the hotbar, the creatures
// alive within 60 m with their hp and brain, the quest step, the flags and the coins. Steps (`--do`) then act on the world
// by real input (keys and the mouse) and read again after each, so a content row's done-when is one line of this JSON.
//
//   node kit/scripts/play-probe.mjs [--staging | --base=<url>] [--entry=select|road|both] [--layout=desktop|phone]
//     [--do=<step>,<step>...] [--out=<dir>] [--seconds=<budget>]
//
// Steps: `wait:<s>`, `face:<x>,<z>`, `shot:<name>` (a screenshot), `fire[:<n>]` (left click n times, one cycle apart), `reload`, `slot:<n>` (press digit n), `use` (E),
// `aim:<creature kind>` (turn to face the nearest one alive), `walk:<x>,<z>` (hold W toward a point of the cell's frame),
// `kill:<creature kind>` (walk within 25 m, aim and fire until it dies or 30 s pass), `shoot:<kind>` (aim, then fire once).
// Default site: a local preview at http://127.0.0.1:5173 (`--base`); `--staging` is https://staging.wildshard.io. Never
// production (J205): a join is a write. Chromium runs headless, muted, capped at 60 fps, and the page closes at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
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
const CELL = 'blender-template', CARD = 'Brasscap Mesa';
const PORCH = { x: -2.2, z: -0.92 }, SPAWN = { x: -1.6, z: 2.6 };
/** The chrome a review page would also pass (scripts/chromium-keychain.mjs in engine), muted. Headless Chromium draws at its
 *  60 Hz begin-frame clock: the probe never asks for more (no vsync or frame-rate flags). */
const ARGS = ['--use-mock-keychain', '--password-store=basic', '--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'];
const sleep = (ms) => new Promise((done) => { setTimeout(done, ms); });

/** Everything the probe reads, in the page. The cell's frame: on a grid page the player's position is the cell's own. */
function read({ porch, spawn }) {
  const W = /** @type {any} */ (window), P = W.__wildshard, world = P?.world;
  if (world === undefined) return { error: 'no world' };
  const st = P.state(), area = P.area?.() ?? null, grid = P.shard?.grid?.state?.() ?? null, pos = st.player.pos;
  const eq = world.weapons, held = eq.current;
  const gun = (w) => ({ id: w.id, has: typeof eq.has === 'function' ? eq.has(w.id) : null, taken: w.taken ?? null, rounds: w.act?.rounds ?? w.state?.magazine ?? null,
    reserve: w.store?.reserve ?? w.state?.reserve ?? null });
  const near = st.creatures.map((c) => ({ ...c, d: Math.round(Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) * 10) / 10 })).filter((c) => c.d <= 60 && c.hp > 0);
  const kinds = {}; for (const c of near) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
  const wire = W.__workerClient?.();
  return {
    inside: grid?.inside ?? area?.instance ?? null, slug: area?.slug ?? null, appState: st.appState,
    pos: { x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100, z: Math.round(pos.z * 100) / 100 }, hp: st.player.health,
    fromPorch: Math.round(Math.hypot(pos.x - porch.x, pos.z - porch.z) * 10) / 10, fromSpawn: Math.round(Math.hypot(pos.x - spawn.x, pos.z - spawn.z) * 10) / 10,
    held: { ...gun(held), state: st.weapon.state }, hotbar: (eq.list ?? []).map(gun),
    creatures: { within60: near.length, kinds, all: st.creatures.length, allAlive: st.creatures.filter((c) => c.hp > 0).length,
      rows: near.slice(0, 24).map((c) => ({ kind: c.kind, hp: Math.round(c.hp * 10) / 10, d: c.d, brain: c.brain })) },
    quest: wire?.quests ?? st.quest, flags: wire?.flags ?? area?.flags ?? [], coins: wire?.paid ?? null, owned: wire?.owned ?? null,
    wire: wire === undefined ? null : { rows: wire.rows, drawn: wire.drawn, hits: wire.hits, kills: wire.kills, hp: wire.hp, fights: wire.fights, cell: wire.cell },
    prompt: world.hud?.promptText ?? null, frames: wire?.frames ?? null,
  };
}

async function enter(page, how) {
  await page.goto(`${base}/?mute=1&nolock=1${how === 'chunk' ? `&chunk=${CELL}` : ''}`, { waitUntil: 'load', timeout: 120_000 });
  if (how === 'chunk') return await ready(page, Date.now());
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

/** The nearest live creature of a kind, in the cell's frame. */
const nearest = (page, kind) => page.evaluate((k) => {
  const st = /** @type {any} */ (window).__wildshard.state(), p = st.player.pos;
  const rows = st.creatures.filter((c) => c.hp > 0 && (c.kind === k || c.id.startsWith(k))).map((c) => ({ ...c, d: Math.hypot(c.pos.x - p.x, c.pos.z - p.z) }));
  rows.sort((a, b) => a.d - b.d); return rows[0] ?? null;
}, kind);

/** Aim at a creature's body: yaw toward it, pitch toward its middle. */
async function aimAt(page, c) {
  const at = await page.evaluate(() => /** @type {any} */ (window).__wildshard.state().player.pos);
  const d = Math.hypot(c.pos.x - at.x, c.pos.z - at.z);
  await face(page, c.pos.x, c.pos.z, Math.atan2(c.pos.y + 0.9 - (at.y + 1.68), Math.max(d, 0.1)));
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
  if (verb === 'face') { const [x, z] = arg.split(',').map(Number); await face(page, x, z); await sleep(400); return { verb }; }
  if (verb === 'shot') { await page.screenshot({ path: join(out, `${arg}.png`) }); return { verb }; }
  if (verb === 'walk') { const [x, z] = arg.split(',').map(Number); return { verb, near: Math.round(await walk(page, x, z)) }; }
  if (verb === 'aim' || verb === 'shoot') {
    const c = await nearest(page, arg); if (c === null) return { verb, found: false };
    await aimAt(page, c); if (verb === 'shoot') await fire(page, 1);
    return { verb, found: true, d: Math.round(c.d) };
  }
  if (verb === 'kill') {
    const first = await nearest(page, arg); if (first === null) return { verb, found: false };
    const ends = Date.now() + 45_000; let shots = 0, target = first;
    while (Date.now() < ends) {
      const c = await page.evaluate((id) => /** @type {any} */ (window).__wildshard.state().creatures.find((row) => row.id === id) ?? null, target.id);
      if (c === null || c.hp <= 0) return { verb, found: true, killed: true, shots };
      const d = await page.evaluate((p) => { const at = /** @type {any} */ (window).__wildshard.state().player.pos; return Math.hypot(p.x - at.x, p.z - at.z); }, c.pos);
      if (d > 25) { await walk(page, c.pos.x, c.pos.z, 20, 15_000); continue; }
      await aimAt(page, c); await fire(page, 1); shots++;
    }
    return { verb, found: true, killed: false, shots };
  }
  throw new Error(`No probe step ${name}`);
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
const browser = await chromium.launch({ headless: true, args: ARGS });
const killer = setTimeout(() => { console.error('play-probe: over budget'); void browser.close().then(() => process.exit(2)); }, budget);
try {
  for (const how of entries) {
    const context = await browser.newContext(phone ? { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 933 } });
    await saveFixture(context, { scope: 'device', key: 'firstPlayDone', data: true });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    await saveFixture(context, { scope: 'global', key: 'settings', merge: true, data: { music: false, sfx: false, volume: 0, ...(phone ? { tier: 'phone' } : {}) } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (error) => { errors.push(error.message.slice(0, 200)); });
    const run = { entry: how };
    try {
      run.loadMs = await enter(page, how);
      if (how === 'road') run.road = await roadIn(page);
      run.at = await page.evaluate(read, { porch: PORCH, spawn: SPAWN });
      if (flag('eval', '') !== '') run.eval = await page.evaluate(flag('eval', '')).catch((error) => String(error));
      await page.screenshot({ path: join(out, `${how}-${phone ? 'phone' : 'desktop'}-enter.png`) }).catch(() => undefined);
      run.steps = [];
      for (const name of steps) {
        const did = await step(page, name);
        run.steps.push({ step: name, ...did, after: await page.evaluate(read, { porch: PORCH, spawn: SPAWN }) });
      }
      if (steps.length > 0) await page.screenshot({ path: join(out, `${how}-${phone ? 'phone' : 'desktop'}-end.png`) }).catch(() => undefined);
    } catch (error) {
      run.error = String(error).slice(0, 300);
      await page.screenshot({ path: join(out, `${how}-${phone ? 'phone' : 'desktop'}-error.png`) }).catch(() => undefined);
    }
    run.errors = errors.slice(0, 8);
    report.runs.push(run);
    await context.close();
  }
} finally { clearTimeout(killer); await browser.close(); }
writeFileSync(join(out, 'probe.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
process.exit(report.runs.every((run) => run.error === undefined) ? 0 : 1);
