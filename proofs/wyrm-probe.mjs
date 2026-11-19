#!/usr/bin/env node
// ONE-FORMAT CC27 (milestone proof M4): two players fight the Dust Wyrm, a serpent on trail bones (CC25) with its fight on
// serpent moves (CC26), on staging. Ana is headless Chromium at desktop size, Bo headless WebKit at Jake's phone size
// (402×874). Both take the rack's rounds, walk the canyon, pull the lever by the gate and go through the side door to the
// pit. There each page's DRAWN Wyrm is read: its skinned mesh's trail bones (head, seg1.., tail) in the cell's frame. The
// two pages' trails must lie on one path: every bone one page draws within 0.1 m of the other page's bone line, sampled
// at the same moment while the Wyrm holds still. Both players then fire at its head until it is weak (half hp) and
// defeated; both must land hits. Shots from both pages at the cleanroom's t2-14 (emerge), t2-15 (weak) and t2-16
// (defeat) spots, with each page's frames per second.
// J205: staging or preview only, never production. Headless and muted, 60 fps cap.
//   node proofs/wyrm-probe.mjs <out dir> [--base=https://staging.wildshard.io] [--chunk=brasscap-mesa] [--seconds=900] [--census]
// --census: enter on one phone page and require every declared NPC figure to draw. Also print the creature meshes and bones.
// Run 2 (2026-11-19) found no skinned mesh with `seg1` bones: the census showed the
// Dust Wyrm drawn with the wyrmling's skin (body, neck, head, jaw; 532 triangles; both skins' rows are `brasscap.wyrm`)
// because staging's loose `shardfiles/brasscap-mesa/shard.json` held an older revision than its index, and a grid page
// never posed a serpent's trail bones (engine `5da116a0b` lays them from the wire rows).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, webkit } from '../scripts/browser-playwright.mjs';
import { saveFixture } from '@wildshard/engine/scripts/debug-settings.mjs';

const [outDir] = process.argv.slice(2).filter(arg => !arg.startsWith('--')).map(path => resolve(path));
const flag = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (outDir === undefined) throw new Error('usage: wyrm-probe.mjs <out dir> [--base=…] [--chunk=…]');
const base = flag('base', 'https://staging.wildshard.io').replace(/\/$/u, '');
const censusOnly = process.argv.includes('--census');
if (!/^https:\/\/(staging|preview)\.wildshard\.io$/u.test(base) && !(censusOnly && /^http:\/\/localhost:\d+$/u.test(base))) {
  throw new Error('--base takes staging or preview, or localhost for the census (J205)');
}
const chunk = flag('chunk', 'brasscap-mesa'), budget = Number(flag('seconds', '900')) * 1000, started = Date.now();
const KEYCHAIN = ['--use-mock-keychain', '--password-store=basic', '--mute-audio'];
mkdirSync(outDir, { recursive: true });

const sleep = ms => new Promise(done => { setTimeout(done, ms); });
const left = () => budget - (Date.now() - started);
const log = [], verdicts = {}, shots = [];
const note = (step, ok, detail) => { log.push({ t: new Date().toISOString(), step, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${step}${detail === undefined ? '' : ` ${JSON.stringify(detail).slice(0, 500)}`}`); return ok; };

/** The cleanroom's three Wyrm cameras (brasscap-cleanroom src/shots.js): feet at (x, z), yaw 0 looks down -z, eye pitch. */
const SPOTS = { 't2-14': { x: 2, z: -84, pitch: 0.02 }, 't2-15': { x: 2, z: -86, pitch: 0.06 }, 't2-16': { x: 2, z: -85, pitch: -0.06 } };
/** The way down: the rack, camp 3's ammo box and strongbox, the lever by the gate, then the side door to the pit. */
const RACK = { x: -2.2, z: -0.92 }, AMMO3 = { x: 13.6, z: -50.2 }, STRONGBOX = { x: 21.5, z: -53 }, LEVER = { x: 7, z: -60.3 };
const ROUTE = [{ x: 3, z: -8 }, { x: 4, z: -20 }, { x: 4, z: -40 }, { x: 8, z: -48 }];
const DOOR = [{ x: -3.3, z: -59.5 }, { x: -3.3, z: -64.5 }, { x: 0, z: -72 }];
const WYRM = 'brasscap.wyrm';

/** A page in Brasscap: devMode on (the net client is readable), muted, 60 fps. */
async function enter(browser, name, device) {
  const context = await browser.newContext(device), page = await context.newPage(), errors = [], assets = [];
  page.on('pageerror', error => { errors.push(error.message.slice(0, 240)); });
  if (censusOnly) {
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text().slice(0, 240));
    });
    page.on('response', response => {
      const { pathname } = new URL(response.url());
      if (pathname.endsWith('.glb')) assets.push({ pathname, status: response.status() });
    });
  }
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { music: false, sfx: false, volume: 0 }, merge: true });
  const t0 = Date.now();
  await page.goto(`${base}/?chunk=${chunk}&mute=1&nolock=1&skipintro=1&fps=60`, { waitUntil: 'load', timeout: 120_000 });
  for (const ends = Date.now() + 150_000; Date.now() < ends;) {
    if (await page.locator('#ws-name-field').isVisible().catch(() => false)) break;
    const clicked = await page.evaluate(() => {
      const load = [...document.querySelectorAll('body *')].find(e => e.children.length === 0 && /^(LOAD|ENTER ZONE|ENTER WORLD)$/u.test((e.textContent ?? '').trim().toUpperCase()));
      if (load === undefined) return false;
      (load.closest('button') ?? load).click(); return true;
    }).catch(() => false);
    if (await page.getByText(/could not load|the world didn.t download/iu).isVisible().catch(() => false)) throw new Error(`${name}: the shard could not load`);
    await sleep(clicked ? 4000 : 1000);
  }
  await page.locator('#ws-name-field').fill(name);
  await page.getByRole('button', { name: /let.s go/iu }).click();
  await page.waitForFunction(() => typeof window.__workerClient === 'function' && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 150_000 });
  await page.evaluate(() => window.__wildshard?.world?.hud?.enterNow?.());
  await page.waitForFunction(() => (window.__workerClient?.().frames ?? 0) > 30, undefined, { timeout: 90_000 });
  await page.getByText('DONE', { exact: true }).click({ timeout: 2000 }).catch(() => undefined);
  note(`${name} entered ${chunk}`, true, { ms: Date.now() - t0, cell: await page.evaluate(() => window.__workerClient().cell) });
  return { name, page, context, errors, assets, hits0: 0 };
}

/** What a page is told and draws: its player (cell frame), its counters, the Wyrm's wire row and its drawn trail bones in
 *  the cell's frame (the skinned mesh under a `neighbour-creature:` root whose skeleton has `seg1`). Runs in the page. */
const look = page => page.evaluate(wyrm => {
  const W = window, world = W.__wildshard.world, { player } = world, net = W.__workerClientNet?.().client, report = W.__workerClient();
  let row = null;
  if (net?.latest) for (const [handle, info] of net.entities) {
    if (info.initial?.species !== wyrm && info.initial?.kind !== 'wyrm' && !String(info.id ?? '').includes('dust-wyrm')) continue;
    const f = net.fields(net.latest, handle);
    if (f !== null && f !== undefined) row = { id: String(info.id), x: Number(f.x), y: Number(f.y), z: Number(f.z), hp: Number(f.hp), alive: Boolean(f.alive), state: f.state ?? null };
  }
  let bones = null;
  world.game.scene.traverse(o => {
    if (bones !== null || !o.isSkinnedMesh || o.skeleton?.bones.some(b => /(^|[^a-z])seg1$/u.test(b.name)) !== true) return;
    let root = o; while (root.parent !== null && !(typeof root.name === 'string' && root.name.startsWith('neighbour-creature:'))) root = root.parent;
    let shown = true; for (let p = o; p !== null; p = p.parent) if (!p.visible) { shown = false; break; }
    const frame = root.parent ?? root;
    frame.updateWorldMatrix(true, false);
    const key = name => name.replace(/^.*[^a-z0-9]/u, ''), seg = name => Number(key(name).slice(3));
    const named = Object.fromEntries(o.skeleton.bones.map(b => [key(b.name), b]));
    const names = ['head', ...Object.keys(named).filter(n => /^seg\d+$/u.test(n)).sort((a, b) => seg(a) - seg(b)), 'tail'];
    bones = { shown, root: root.name, points: names.map(name => { const bone = named[name]; if (bone === undefined) return null;
      const at = bone.getWorldPosition(bone.position.clone()); frame.worldToLocal(at); return [at.x, at.y, at.z]; }) };
  });
  const census = [];
  if (bones === null) world.game.scene.traverse(o => { if (o.isSkinnedMesh && census.length < 12) census.push({ name: o.name, bones: o.skeleton?.bones.slice(0, 6).map(b => b.name) ?? null, n: o.skeleton?.bones.length ?? 0 }); });
  const cam = world.game.camera;
  return { me: { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, eye: cam.matrixWorld.elements[13] }, hp: report.hp, hits: report.hits,
    kills: report.kills, census, fps: report.framesPerSecond, fights: report.fights, flags: report.flags, wyrm: row, bones, prompt: world.hud?.promptText ?? null,
    held: (() => { const w = world.weapons?.current; return w === undefined ? null : { id: w.id, rounds: w.act?.rounds ?? w.state?.magazine ?? null, reserve: w.store?.reserve ?? w.state?.reserve ?? null }; })() };
}, WYRM);

/** Steer the page's own player by its touch stick (both pages take it): face (x, z), push forward, sprint. */
const steer = (page, x, z, forward, sprint, pitch = -0.1) => page.evaluate(([tx, tz, y, run, p]) => {
  const { player } = window.__wildshard.world;
  player.yaw = Math.atan2(-(tx - player.position.x), -(tz - player.position.z)); player.pitch = p;
  player.touchMove.x = 0; player.touchMove.y = y; player.touchSprint = run;
}, [x, z, forward, sprint, pitch]);
const stop = page => page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.x = 0; player.touchMove.y = 0; player.touchSprint = false; });
const press = (page, action) => page.evaluate(name => { window.__wildshard.world.game.app.input.press(name); }, action);

/** Walk to within `near` m of (x, z); a jump when stuck. */
async function walkTo(who, to, near = 1.2, seconds = 40) {
  let last = null, stuck = 0;
  for (const ends = Date.now() + seconds * 1000; Date.now() < ends;) {
    const { me } = await look(who.page), away = Math.hypot(to.x - me.x, to.z - me.z);
    if (away <= near) { await stop(who.page); return away; }
    if (last !== null && Math.hypot(me.x - last.x, me.z - last.z) < 0.1 && ++stuck % 6 === 0) await press(who.page, 'jump');
    last = me;
    await steer(who.page, to.x, to.z, 1, away > 4);
    await sleep(150);
  }
  await stop(who.page);
  const { me } = await look(who.page);
  return Math.hypot(to.x - me.x, to.z - me.z);
}
async function walkAll(who, points, near) { let away = 0; for (const point of points) away = await walkTo(who, point, near); return away; }
/** Use the prompt at `at`: stand at it, face it, press E (both pages take the `use` action). */
async function use(who, at) {
  await walkTo(who, at, 1.4);
  await steer(who.page, at.x, at.z, 0, false, -0.2);
  await sleep(300);
  const before = (await look(who.page)).prompt;
  await press(who.page, 'use');
  await sleep(900);
  return before;
}

/** The farthest any point of trail `a` lies from trail `b`'s polyline, both in the cell's frame. */
function apart(a, b) {
  const pa = a.filter(p => p !== null), pb = b.filter(p => p !== null);
  let worst = 0;
  for (const p of pa) {
    let best = Infinity;
    for (let i = 0; i + 1 < pb.length; i++) {
      const [ax, ay, az] = pb[i], [bx, by, bz] = pb[i + 1], dx = bx - ax, dy = by - ay, dz = bz - az, len2 = dx * dx + dy * dy + dz * dz;
      const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy + (p[2] - az) * dz) / len2));
      best = Math.min(best, Math.hypot(p[0] - (ax + dx * t), p[1] - (ay + dy * t), p[2] - (az + dz * t)));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

const shot = async (who, name) => { const file = `${who.name.toLowerCase()}-${name}.png`; await who.page.screenshot({ path: resolve(outDir, file) }).catch(() => undefined); return file; };
/** Both players to a cleanroom spot (Bo a metre east), facing down the canyon, then a shot from each with its fps. */
async function board(ana, bo, id, wyrm) {
  const spot = SPOTS[id];
  await Promise.all([walkTo(ana, spot, 0.6, 12), walkTo(bo, { x: spot.x + 1, z: spot.z }, 0.6, 12)]);
  for (const who of [ana, bo]) await who.page.evaluate(p => { const { player } = window.__wildshard.world; player.yaw = 0; player.pitch = p; }, spot.pitch);
  await sleep(700);
  const [a, b] = [await look(ana.page), await look(bo.page)];
  shots.push({ id, wyrm, ana: { file: await shot(ana, id), fps: a.fps, at: a.me, hp: a.wyrm?.hp }, bo: { file: await shot(bo, id), fps: b.fps, at: b.me, hp: b.wyrm?.hp } });
  note(`${id} (${wyrm}): shots from both pages`, true, { anaFps: a.fps, boFps: b.fps, hp: a.wyrm?.hp });
}

/** Both pages' trails at the same moment, `n` times. Each page's bones behind its head are measured against the other
 *  page's bone line (the head is left out: whichever page draws a later moment leads by up to one interpolation step). */
async function trails(ana, bo, n, label) {
  const rows = [];
  for (let i = 0; i < n * 4 && rows.length < n; i++) {
    const [a, b] = await Promise.all([look(ana.page), look(bo.page)]);
    if (a.bones === null || b.bones === null) { await sleep(250); continue; }
    const [ha, hb] = [a.bones.points[0], b.bones.points[0]];
    rows.push({ worst: Math.max(apart(a.bones.points.slice(1), b.bones.points), apart(b.bones.points.slice(1), a.bones.points)),
      heads: ha && hb ? Math.hypot(ha[0] - hb[0], ha[1] - hb[1], ha[2] - hb[2]) : null, head: ha, bones: a.bones.points.length, shown: [a.bones.shown, b.bones.shown] });
    await sleep(250);
  }
  const sorted = rows.map(row => row.worst).sort((x, y) => x - y), worst = sorted.at(-1) ?? null, median = sorted[Math.floor(sorted.length / 2)] ?? null;
  note(`trail ${label}: both pages draw one trail within 0.1 m`, rows.length > 0 && worst <= 0.1, { samples: rows.length, worst, median, rows: rows.slice(0, 4) });
  return { label, samples: rows.length, worst, median, rows };
}

/** Fire at the Wyrm's drawn head from where the player stands; reload when the magazine is dry. */
async function fireAt(who) {
  const seen = await look(who.page);
  // the drawn head, else the wire row a few metres up
  const head = seen.bones?.points[0] ?? (seen.wyrm === null ? null : [seen.wyrm.x, seen.wyrm.y + 4, seen.wyrm.z]);
  if (head === null) return false;
  await who.page.evaluate(([x, z, y]) => {
    const { player, game } = window.__wildshard.world, eye = game.camera.matrixWorld.elements[13];
    player.yaw = Math.atan2(-(x - player.position.x), -(z - player.position.z));
    player.pitch = Math.atan2(y - eye, Math.max(0.1, Math.hypot(x - player.position.x, z - player.position.z)));
    player.touchMove.x = 0; player.touchMove.y = 0;
  }, [head[0], head[2], head[1]]);
  if (seen.held !== null && seen.held.rounds === 0) { await press(who.page, 'reload'); return true; }
  await press(who.page, 'attack');
  return true;
}

/** Each declared figure must submit a mesh to the player's camera, not merely exist under a hidden group. */
async function npcCensus(page) {
  const directory = new URL('../src/rows/npcs/', import.meta.url);
  const talks = readdirSync(directory).filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(readFileSync(new URL(file, directory), 'utf8')).npc.talk);
  if (talks.length === 0) throw new Error('No Brasscap talk figures declared');
  const reports = [];
  for (const talk of talks) {
    reports.push(await page.evaluate(async ({ id, figure, at }) => {
      const { game, player } = window.__wildshard.world;
      const key = name => name.replace(/[^a-z0-9]/giu, '').toLowerCase();
      const names = new Set(figure === undefined ? [key(`talk:${id}`)] : [key(`scene.panel.${figure}`)]);
      const meshes = new Set();
      game.scene.traverse(root => {
        if (names.has(key(root.name))) root.traverse(mesh => { if (mesh.isMesh) meshes.add(mesh); });
      });
      let draws = 0;
      const hooks = new Map();
      for (const mesh of meshes) {
        const previous = mesh.onAfterRender;
        hooks.set(mesh, previous);
        mesh.onAfterRender = function (...args) {
          previous.apply(this, args);
          if (args[2] === game.camera) draws++;
        };
      }
      const { yaw, pitch } = player;
      try {
        player.yaw = Math.atan2(player.position.x - at[0], player.position.z - at[2]);
        player.pitch = Math.atan2(at[1] + 0.8 - game.camera.position.y, Math.max(0.1, Math.hypot(at[0] - player.position.x, at[2] - player.position.z)));
        for (let frames = 0; meshes.size > 0 && draws === 0 && frames < 8; frames++) await new Promise(resolve => requestAnimationFrame(resolve));
        return { id, figure, meshes: meshes.size, draws };
      } finally {
        player.yaw = yaw;
        player.pitch = pitch;
        for (const [mesh, previous] of hooks) mesh.onAfterRender = previous;
      }
    }, talk));
  }
  return reports;
}

const cBrowser = censusOnly ? null : await chromium.launch({ headless: true, args: [...KEYCHAIN, '--use-angle=metal', '--ignore-gpu-blocklist'] });
const wBrowser = await webkit.launch({ headless: true });
let ana, bo;
const trailRows = [];
async function proveFight() {
  [ana, bo] = await Promise.all([
    enter(cBrowser, 'Ana', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }),
    enter(wBrowser, 'Bo', { viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, hasTouch: true }),
  ]);
  const met = await look(ana.page);
  note('two players in Brasscap', true, { ana: met.me, wyrm: met.wyrm, held: met.held });
  // the rack's rounds, camp 3's ammo box and strongbox, the lever, the side door, the pit's edge
  await Promise.all([ana, bo].map(async who => {
    who.rack = await use(who, RACK);
    await walkAll(who, ROUTE, 2);
    who.ammo = await use(who, AMMO3);
    who.strongbox = await use(who, STRONGBOX);
    who.lever = await use(who, LEVER);
    who.door = await walkAll(who, DOOR, 1.2);
  }));
  for (const who of [ana, bo]) { const seen = await look(who.page); note(`${who.name} at the pit's edge`, who.door <= 1.5, { rack: who.rack, ammo: who.ammo, strongbox: who.strongbox, lever: who.lever, me: seen.me, held: seen.held, hp: seen.hp }); }
  // into the arena (16 m round the mound at (2, -100)): the fight starts and the Wyrm comes up
  await Promise.all([walkTo(ana, SPOTS['t2-14'], 0.6, 20), walkTo(bo, { x: 3, z: -84 }, 0.6, 20)]);
  for (const who of [ana, bo]) who.hits0 = (await look(who.page)).hits;
  let emerged = false;
  for (const ends = Date.now() + 30_000; Date.now() < ends && !emerged;) {
    await walkTo(ana, { x: 2, z: -86.5 }, 0.6, 3);
    const seen = await look(ana.page);
    emerged = seen.bones !== null && seen.bones.shown && (seen.bones.points[0]?.[1] ?? -9) > -0.5;
    if (!emerged) await sleep(500);
  }
  { const seen = await look(ana.page); note('the Wyrm comes up, drawn on Ana\'s page', emerged, { points: seen.bones?.points.slice(0, 3), census: seen.census, wyrm: seen.wyrm }); }
  await board(ana, bo, 't2-14', 'emerge');
  trailRows.push(await trails(ana, bo, 6, 'emerge'));
  // the fight: both fire at its head; t2-15 once it is weak (half hp), t2-16 once it is down
  let weak = false, down = false, hp0 = null;
  while (left() > 30_000 && !down) {
    await Promise.all([fireAt(ana), fireAt(bo)]);
    await sleep(700);
    const seen = await look(bo.page);
    if (seen.wyrm !== null) { hp0 ??= seen.wyrm.hp; if (!weak && seen.wyrm.hp <= 220) { weak = true; await board(ana, bo, 't2-15', 'weak'); trailRows.push(await trails(ana, bo, 4, 'weak')); } }
    if (seen.wyrm !== null && (!seen.wyrm.alive || seen.wyrm.hp <= 0)) down = true;
    if (seen.hp <= 0 || (await look(ana.page)).hp <= 0) await sleep(4000);
  }
  if (down) await board(ana, bo, 't2-16', 'defeat');
  const [a, b] = [await look(ana.page), await look(bo.page)];
  const landed = { Ana: a.hits - ana.hits0, Bo: b.hits - bo.hits0 };
  verdicts.trail = trailRows.length > 0 && trailRows.every(row => row.samples > 0 && row.worst <= 0.1);
  verdicts.hits = note('both players land hits on the Wyrm', landed.Ana > 0 && landed.Bo > 0, { landed, wyrm: b.wyrm, fights: b.fights });
  verdicts.weak = note('the Wyrm goes weak (half hp)', weak, { hp0 });
  verdicts.defeat = note('the Wyrm goes down', down, b.wyrm);
}
try {
  if (censusOnly) {
    bo = await enter(wBrowser, 'Bo', { viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, hasTouch: true });
    const figures = await npcCensus(bo.page);
    verdicts.npcs = note('all declared NPC figures draw', figures.every(row => row.draws > 0), figures);
    const creatures = await bo.page.evaluate(() => {
      const rows = [];
      window.__wildshard.world.game.scene.traverse(o => {
        if (!o.isSkinnedMesh && !/creature|wyrm|serpent/iu.test(o.name)) return;
        rows.push({ name: `${o.type}:${o.name}`, bones: o.skeleton?.bones.map(b => b.name) ?? null, parent: o.parent?.name ?? null, visible: o.visible,
          at: [o.position.x, o.position.y, o.position.z].map(n => Math.round(n * 10) / 10),
          triangles: o.geometry === undefined ? null : (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3 });
      });
      return rows;
    });
    writeFileSync(resolve(outDir, 'census.json'), `${JSON.stringify({ figures, creatures, assets: bo.assets }, null, 1)}\n`);
  } else {
    await proveFight();
  }
} catch (error) {
  verdicts.threw = note('probe threw', false, String(error?.stack ?? error).slice(0, 800));
} finally {
  const errors = { ana: ana?.errors ?? [], bo: bo?.errors ?? [] };
  writeFileSync(resolve(outDir, 'probe.json'), `${JSON.stringify({ base, chunk, verdicts, trails: trailRows, shots, log, errors }, null, 1)}\n`);
  await cBrowser?.close(); await wBrowser.close();
}
console.log(JSON.stringify(verdicts));
process.exitCode = Object.values(verdicts).every(Boolean) ? 0 : 1;
