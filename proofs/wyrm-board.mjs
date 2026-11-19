// CC27 board: staging shots (Ana desktop, Bo phone) at t2-14/15/16 beside the cleanroom captures, fps stated.
//   node proofs/wyrm-board.mjs <probe dir> ../brasscap-cleanroom/captures <out.html>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const [dir, captures, out] = process.argv.slice(2).map(p => resolve(p));
const probe = JSON.parse(readFileSync(join(dir, 'probe.json'), 'utf8'));
const cleanFps = JSON.parse(readFileSync(join(captures, 'fps.json'), 'utf8'));
const jpeg = (file, width) => {
  if (!existsSync(file)) return null;
  const tmp = `${file}.${width}.jpg`;
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '--resampleWidth', String(width), file, '--out', tmp], { stdio: 'ignore' });
  return `data:image/jpeg;base64,${readFileSync(tmp).toString('base64')}`;
};
const esc = s => String(s).replace(/[&<>"]/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => (typeof n === 'number' ? n.toFixed(1) : '—');
const NAMES = { 't2-14': 'Emerge', 't2-15': 'Weak', 't2-16': 'Defeat' };
const rows = ['t2-14', 't2-15', 't2-16'].map(id => {
  const s = probe.shots.find(row => row.id === id);
  const clean = jpeg(join(captures, `${id}.jpg`), 900);
  const ana = s ? jpeg(join(dir, s.ana.file), 900) : null, bo = s ? jpeg(join(dir, s.bo.file), 402) : null;
  const cell = (src, label, alt) => src === null ? `<div class="missing">${esc(label)}: not reached</div>` : `<img src="${src}" alt="${esc(alt)}">`;
  return `<section class="beat"><header><h2>${id} · ${NAMES[id]}</h2>
  <p class="meta">Cleanroom ${fmt(cleanFps[id]?.fps)} fps (uncapped, M5 Max) · Ana desktop ${fmt(s?.ana.fps)} fps · Bo phone ${fmt(s?.bo.fps)} fps (both capped at 60) · Wyrm hp ${s?.ana.hp ?? '—'} of 440</p></header>
  <div class="trio"><figure>${cell(clean, 'cleanroom', `${id} cleanroom`)}<figcaption>Cleanroom</figcaption></figure>
  <figure>${cell(ana, 'desktop', `${id} Ana on staging, desktop`)}<figcaption>Ana · staging · Chromium 1280×800</figcaption></figure>
  <figure class="phone">${cell(bo, 'phone', `${id} Bo on staging, phone`)}<figcaption>Bo · staging · WebKit 402×874</figcaption></figure></div></section>`;
}).join('\n');
const trail = probe.trails.map(t => `<li><b>${esc(t.label)}</b>: ${t.samples === 0 ? 'not read. The probe found no skinned mesh with trail bones on either page, so the trail check is still open.' : `${t.samples} paired samples, worst gap ${(t.worst * 100).toFixed(1)} cm`}</li>`).join('');
const v = probe.verdicts, pass = k => (v[k] ? 'pass' : 'fail');
const hitsLine = probe.log.find(row => row.step.startsWith('both players land hits'))?.detail?.landed;
const html = `<title>Dust Wyrm M4 Proof</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* layout: one band per fight beat, cleanroom | desktop | phone side by side */
:root{--bg:#f3efe7;--fg:#2a2218;--muted:#6f6352;--line:#d9cfbf;--accent:#b5652a;--ok:#2f7a3d;--bad:#a8322a;
--display:"Rye","Georgia",serif;--body:"Inter",system-ui,sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1b1712;--fg:#efe6d6;--muted:#a8997f;--line:#3a3127;--accent:#e08a4a;--ok:#6cc27a;--bad:#ec6b60;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1b1712;--fg:#efe6d6;--muted:#a8997f;--line:#3a3127;--accent:#e08a4a;--ok:#6cc27a;--bad:#ec6b60;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:24px}
h1{font-family:var(--display);font-weight:400;font-size:2rem;margin:0 0 4px;color:var(--accent);text-wrap:balance}
h2{font-family:var(--display);font-weight:400;font-size:1.3rem;margin:0}
.lede{color:var(--muted);max-width:70ch;margin:0 0 16px}
.verdicts{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;padding:0;list-style:none}
.verdicts li{border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:.85rem}
.pass{color:var(--ok)}.fail{color:var(--bad)}
.facts{margin:0 0 24px;color:var(--fg);font-variant-numeric:tabular-nums}
.beat{border-top:1px solid var(--line);padding-block:16px;display:grid;gap:10px}
.meta{margin:2px 0 0;color:var(--muted);font-size:.85rem;font-variant-numeric:tabular-nums}
.trio{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,3fr) minmax(0,1.2fr);gap:12px;align-items:start}
figure{margin:0;min-width:0}figure img{width:100%;display:block;border-radius:4px}
figcaption{font-size:.78rem;color:var(--muted);margin-top:4px}
.missing{aspect-ratio:16/10;display:grid;place-items:center;border:1px dashed var(--line);color:var(--muted);font-size:.85rem}
.phone .missing{aspect-ratio:402/874}
@media (max-width:720px){.trio{grid-template-columns:1fr}.phone{max-width:240px}}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rye&family=Inter:wght@400;600&display=swap">
<h1>Dust Wyrm M4 Proof</h1>
<p class="lede">ONE-FORMAT CC27, ${esc(new Date().toISOString().slice(0, 10))}. Two players fight the Dust Wyrm on staging (Brasscap revision 9, engine v0.1.48): Ana in headless Chromium at desktop size, Bo in headless WebKit at phone size. Each beat sits beside the cleanroom capture from the same spot.</p>
<ul class="verdicts"><li class="${pass('trail')}">One trail within 10 cm: ${pass('trail')}</li><li class="${pass('hits')}">Both land hits: ${pass('hits')}</li><li class="${pass('weak')}">Weak: ${pass('weak')}</li><li class="${pass('defeat')}">Defeat: ${pass('defeat')}</li></ul>
<div class="facts"><ul>${trail}</ul><p>Hits landed on the Wyrm: Ana ${hitsLine?.Ana ?? '—'}, Bo ${hitsLine?.Bo ?? '—'}. Trail gap is the farthest any drawn trail bone on one page sits from the other page's bone line, read at the same moment while the head held still.</p></div>
${rows}`;
writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024), 'KB');
