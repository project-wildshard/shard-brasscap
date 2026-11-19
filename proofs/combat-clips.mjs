#!/usr/bin/env node
// QA42/QA44 (meta QA-FEEDBACK-2026-11-19, lane opus-brasscap-combat): the combat clips Jake's board shows, before and after.
// One headless WebKit phone page (402×874, muted, 60 fps) records one video; each scene's start and end are written to
// scenes.json and cut into its own clip with ffmpeg.
//   bandits camp 1: stand off at 9 m, take their fire, shoot back until they drop
//   guns    take the scattergun and the long rifle; each gun: three shots at the sand below camp 2, then a reload
//   wyrm    the rack, camp 3's ammo, the lever and the side door, then the whole Dust Wyrm fight to its death
// J205: staging or preview, or a localhost `pnpm dev` world.
//   node proofs/combat-clips.mjs <out dir> [--base=https://staging.wildshard.io] [--scenes=guns,bandits,wyrm] [--seconds=900]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aimAt, checkBase, enterPhone, finish, look, press, sleep, steer, stop, use, walkTo } from './combat-harness.mjs';

const [outDir] = process.argv.slice(2).filter(arg => !arg.startsWith('--')).map(path => resolve(path));
const flag = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (outDir === undefined) throw new Error('usage: combat-clips.mjs <out dir> [--base=…] [--scenes=…]');
const base = checkBase(flag('base', 'https://staging.wildshard.io'));
const wanted = new Set(flag('scenes', 'bandits,guns,wyrm').split(','));
const budget = Number(flag('seconds', '900')) * 1000, started = Date.now();
const left = () => budget - (Date.now() - started);

const RACK = { x: -2.2, z: -0.92 }, AMMO3 = { x: 13.6, z: -50.2 }, STRONGBOX = { x: 21.5, z: -53 }, LEVER = { x: 7, z: -60.3 }, CACHE = { x: 6.5, z: -86.5 };
const ROUTE = [{ x: 3, z: -8 }, { x: 4, z: -20 }, { x: 4, z: -40 }, { x: 8, z: -48 }];
const DOOR = [{ x: -3.3, z: -59.5 }, { x: -3.3, z: -64.5 }, { x: 0, z: -72 }];
const GUNS = ['brasscap-lever', 'brasscap-scattergun', 'brasscap-long-rifle'];

const session = await enterPhone({ base, video: resolve(outDir, 'raw') });
const { page } = session, t0 = Date.now(), scenes = [], log = [];
const now = () => (Date.now() - t0) / 1000;
const note = (step, detail) => { log.push({ t: now(), step, detail }); console.log(`${now().toFixed(1)} ${step}${detail === undefined ? '' : ` ${JSON.stringify(detail).slice(0, 300)}`}`); };
const shot = name => page.screenshot({ path: resolve(outDir, `${name}.png`) }).catch(() => undefined);
async function scene(name, run) {
  if (!wanted.has(name) || left() < 30_000) return;
  const start = now();
  try { await run(); } catch (error) { note(`${name} threw`, String(error?.message ?? error).slice(0, 300)); }
  scenes.push({ name, start, end: now() });
}
/** Hold the named gun (the page's own pick; the wire follows the selection). */
const hold = id => page.evaluate(gun => {
  const { weapons } = window.__wildshard.world, row = weapons.list.find(w => String(w.id ?? w.row?.id).endsWith(gun));
  if (row === undefined) return null;
  const id = row.id ?? row.row.id; weapons.unlock(id); weapons.select(id, true); return id;
}, id);
/** The nearest living creature of `species` to the player. */
async function nearest(species) {
  const seen = await look(page);
  return seen.creatures.filter(c => c.species === species && c.alive)
    .sort((a, b) => Math.hypot(a.x - seen.me.x, a.z - seen.me.z) - Math.hypot(b.x - seen.me.x, b.z - seen.me.z))[0] ?? null;
}

await scene('bandits', async () => {
  note('rack', await use(page, RACK));
  await walkTo(page, { x: -4, z: -16 }, 0.8, 25);
  const first = await nearest('brasscap.bandit');
  if (first === null) return;
  // stand off, let them shoot, then shoot back
  await aimAt(page, [first.x, first.y + 1.1, first.z]);
  await sleep(5000); await shot('bandit-incoming');
  for (const ends = Date.now() + 45_000; Date.now() < ends;) {
    const target = await nearest('brasscap.bandit'), seen = await look(page);
    if (target === null || Math.hypot(target.x - seen.me.x, target.z - seen.me.z) > 18) break;
    await aimAt(page, [target.x, target.y + 0.85, target.z]);
    if (seen.held?.ammo === 0) { await press(page, 'reload'); await sleep(2500); continue; }
    await press(page, 'attack'); await sleep(900);
  }
  await sleep(2500); await shot('bandit-after');
});

/** Take the scattergun at camp 1 and the long rifle up camp 2's stairs, then fire each gun at the sand and reload it. */
await scene('guns', async () => {
  note('scattergun', await use(page, { x: -12.6, z: -26.4 }));
  for (const point of [{ x: 4, z: -21 }, { x: 9.3, z: -21.5 }, { x: 9.3, z: -34 }]) await walkTo(page, point, 0.8, 30);
  note('long rifle', await use(page, { x: 12.3, z: -33 }));
  await walkTo(page, { x: 11.5, z: -34 }, 0.6, 10);
  for (const gun of GUNS) {
    note('hold', await hold(gun));
    await sleep(1500);
    const seen = await look(page);
    // the canyon floor 14 m out to the west, below camp 2's platform
    await aimAt(page, [seen.me.x - 14, 0.2, seen.me.z + 2]);
    await sleep(500); await shot(`gun-${gun}-aim`);
    for (let i = 0; i < 3; i++) {
      await press(page, 'attack'); await sleep(90); if (i === 0) await shot(`gun-${gun}-fire`);
      await sleep(1100);
    }
    await press(page, 'reload'); await sleep(500); await shot(`gun-${gun}-reload`);
    await sleep(3500);
    note('fired', (await look(page)).held);
  }
  await hold(GUNS[0]);
  for (const point of [{ x: 9.3, z: -34 }, { x: 9.3, z: -21.5 }, { x: 4, z: -24 }]) await walkTo(page, point, 0.8, 30);
});

await scene('wyrm', async () => {
  if (!wanted.has('bandits')) note('rack', await use(page, RACK));
  for (const point of ROUTE.slice(wanted.has('guns') ? 2 : 0)) await walkTo(page, point, 2);
  note('ammo', await use(page, AMMO3)); note('strongbox', await use(page, STRONGBOX)); note('lever', await use(page, LEVER));
  for (const point of DOOR) await walkTo(page, point, 1.2);
  await walkTo(page, { x: 2, z: -88 }, 0.6, 20); // inside the arena (16 m round the mound at z -100), or the fight never starts
  let down = false, weak = false, dry = 0;
  for (const ends = Date.now() + Math.min(left() - 20_000, 360_000); Date.now() < ends && !down;) {
    const wyrm = (await look(page)).creatures.find(c => c.species === 'brasscap.wyrm');
    if (wyrm === undefined) { await walkTo(page, { x: 2, z: -86.5 }, 0.6, 3); await sleep(500); continue; }
    if (!wyrm.alive && wyrm.hp <= 0) { down = true; break; } // both: a burrowed Wyrm can read not-alive for a frame
    if (!weak && wyrm.hp <= 220) { weak = true; await shot('wyrm-weak'); }
    const head = await page.evaluate(() => {
      let at = null;
      window.__wildshard.world.game.scene.traverse(o => {
        if (at !== null || !o.isSkinnedMesh) return;
        const bone = o.skeleton?.bones.find(b => /(^|[^a-z])head$/u.test(b.name));
        if (bone !== undefined && o.skeleton.bones.some(b => /seg1$/u.test(b.name))) { const p = bone.getWorldPosition(bone.position.clone()); at = [p.x, p.y, p.z]; }
      });
      return at;
    });
    await aimAt(page, head ?? [wyrm.x, wyrm.y + 4, wyrm.z]);
    const seen = await look(page);
    if (seen.held?.ammo === 0 && seen.held.reserve === 0) { // out of this gun's rounds: the next gun, as a player would
      if (++dry >= GUNS.length) { // every gun dry: the arena's ammo cache, then back in
        dry = 0; await hold(GUNS[0]); note('cache', await use(page, CACHE)); await walkTo(page, { x: 2, z: -88 }, 0.8, 15); continue;
      }
      const at = GUNS.findIndex(gun => String(seen.held.id).endsWith(gun));
      note('switch', await hold(GUNS[(at + 1) % GUNS.length])); await sleep(1500); continue;
    }
    if ((seen.held?.ammo ?? 0) > 0) dry = 0;
    if (seen.held?.ammo === 0) { await press(page, 'reload'); await sleep(2000); continue; }
    if (seen.hp <= 0) { await sleep(4000); continue; }
    await press(page, 'attack'); await sleep(750);
  }
  note('wyrm down', down);
  await sleep(1500); await shot('wyrm-death');
  await sleep(6000); await shot('wyrm-after');
});

await stop(page).catch(() => undefined);
note('errors', session.errors);
const raw = resolve(outDir, 'session.webm');
await finish(session, raw);
writeFileSync(resolve(outDir, 'scenes.json'), `${JSON.stringify({ base, scenes, log }, null, 1)}\n`);
// the video starts at the page's creation, the scenes' clock at entry
for (const { name, start, end } of scenes) {
  const offset = (t0 - session.created) / 1000;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start + offset), '-to', String(end + offset), '-i', raw,
    '-vf', 'fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', resolve(outDir, `${name}.mp4`)]);
}
console.log(JSON.stringify(scenes));
