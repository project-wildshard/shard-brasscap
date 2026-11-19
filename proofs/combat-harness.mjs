// QA42/QA44 (meta QA-FEEDBACK-2026-11-19, lane opus-brasscap-combat): the page helpers the combat clips share. A headless
// WebKit page at Jake's phone size (402×874), muted, 60 fps, recording a video, entered into Brasscap Mesa with devMode on.
// J205: staging or preview, or a localhost `pnpm dev` world. Never production.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { webkit } from '../scripts/browser-playwright.mjs';
import { saveFixture } from '@wildshard/engine/scripts/debug-settings.mjs';

export const sleep = ms => new Promise(done => { setTimeout(done, ms); });
export const PHONE = { viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, hasTouch: true };

/** The base url, refusing production (J205). */
export function checkBase(base) {
  const clean = base.replace(/\/$/u, '');
  if (!/^https:\/\/(staging|preview)\.wildshard\.io$/u.test(clean) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/u.test(clean)) {
    throw new Error('base takes staging, preview or a localhost world (J205)');
  }
  return clean;
}

/** A recording phone page in Brasscap. `video` is the folder the clip lands in. */
export async function enterPhone({ base, chunk = 'brasscap-mesa', video, name = 'Bo' }) {
  mkdirSync(video, { recursive: true });
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...PHONE, recordVideo: { dir: video, size: PHONE.viewport } });
  const page = await context.newPage(), errors = [], created = Date.now();
  page.on('pageerror', error => { errors.push(error.message.slice(0, 240)); });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { music: false, sfx: false, volume: 0 }, merge: true });
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
  return { browser, context, page, errors, name, created };
}

/** What the page holds and sees. */
export const look = page => page.evaluate(() => {
  const W = window, world = W.__wildshard.world, { player } = world, report = W.__workerClient(), net = W.__workerClientNet?.().client;
  const creatures = [];
  if (net?.latest) for (const [handle, info] of net.entities) {
    const f = net.fields(net.latest, handle), species = info.initial?.species;
    if (f !== null && f !== undefined && typeof species === 'string') creatures.push({ handle, id: String(info.id ?? ''), species, x: Number(f.x), y: Number(f.y), z: Number(f.z), hp: Number(f.hp), alive: Boolean(f.alive) });
  }
  const w = world.weapons?.current;
  return { me: { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw }, hp: report.hp, hits: report.hits, kills: report.kills,
    fps: report.framesPerSecond, prompt: world.hud?.promptText ?? null, creatures,
    held: w === undefined ? null : { id: w.row?.id ?? w.id, ammo: w.state?.ammo ?? null, reserve: w.state?.reserve ?? null, reloading: w.state?.reloading ?? null } };
});

/** Face (x, z) and walk toward it on the touch stick. */
export const steer = (page, x, z, forward, sprint, pitch = -0.1) => page.evaluate(([tx, tz, y, run, p]) => {
  const { player } = window.__wildshard.world;
  player.yaw = Math.atan2(-(tx - player.position.x), -(tz - player.position.z)); player.pitch = p;
  player.touchMove.x = 0; player.touchMove.y = y; player.touchSprint = run;
}, [x, z, forward, sprint, pitch]);
export const stop = page => page.evaluate(() => { const { player } = window.__wildshard.world; player.touchMove.x = 0; player.touchMove.y = 0; player.touchSprint = false; });
export const press = (page, action) => page.evaluate(name => { window.__wildshard.world.game.app.input.press(name); }, action);
/** Aim the eye at a world point. */
export const aimAt = (page, [x, y, z]) => page.evaluate(([tx, ty, tz]) => {
  const { player, game } = window.__wildshard.world, eye = game.camera.matrixWorld.elements[13];
  player.yaw = Math.atan2(-(tx - player.position.x), -(tz - player.position.z));
  player.pitch = Math.atan2(ty - eye, Math.max(0.1, Math.hypot(tx - player.position.x, tz - player.position.z)));
}, [x, y, z]);

/** Walk to within `near` m of (x, z); a jump when stuck. */
export async function walkTo(page, to, near = 1.2, seconds = 40) {
  let last = null, stuck = 0;
  for (const ends = Date.now() + seconds * 1000; Date.now() < ends;) {
    const { me } = await look(page), away = Math.hypot(to.x - me.x, to.z - me.z);
    if (away <= near) { await stop(page); return away; }
    if (last !== null && Math.hypot(me.x - last.x, me.z - last.z) < 0.1 && ++stuck % 6 === 0) await press(page, 'jump');
    last = me;
    await steer(page, to.x, to.z, 1, away > 4);
    await sleep(150);
  }
  await stop(page);
  const { me } = await look(page);
  return Math.hypot(to.x - me.x, to.z - me.z);
}
/** Use the prompt at `at`: stand at it, face it, press E. */
export async function use(page, at) {
  await walkTo(page, at, 1.4);
  await steer(page, at.x, at.z, 0, false, -0.2);
  await sleep(300);
  const before = (await look(page)).prompt;
  await press(page, 'use');
  await sleep(900);
  return before;
}
/** Close the page and keep its video at `file`. */
export async function finish(session, file) {
  const video = session.page.video();
  await session.context.close();
  if (video !== null) await video.saveAs(resolve(file)).catch(() => undefined);
  await session.browser.close();
}
