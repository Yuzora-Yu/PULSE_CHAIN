import { readdir, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
const base = '/games/PULSE_CHAIN/';
const files = await readdir('dist', { recursive: true });
const assets = files
  .filter((f) => /\.(js|css|html|svg|png|webmanifest)$/.test(f))
  .map((f) => base + f.replaceAll('\\', '/'));
const digest = createHash('sha256');
for (const asset of [...assets].sort()) digest.update(await readFile('dist/' + asset.slice(base.length)));
const build = digest.digest('hex').slice(0, 12);
const sw = `const CACHE='pulse-chain-${build}',BASE='${base}',ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pulse-chain-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(BASE))return;
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match(BASE+(u.pathname.endsWith('inspector.html')?'inspector.html':'index.html'),{ignoreVary:true}))));return;}
e.respondWith(caches.open(CACHE).then(c=>c.match(e.request,{ignoreVary:true})).then(c=>c||fetch(e.request)));});`;
await writeFile('dist/sw.js', sw);
const sitePath = resolve('site');
if (
  sitePath !== process.cwd() + sep + 'site' ||
  JSON.parse(await readFile('package.json', 'utf8')).name !== 'pulse-chain'
)
  throw Error('Unexpected build workspace');
await rm(sitePath, { recursive: true, force: true });
await mkdir('site/games/PULSE_CHAIN', { recursive: true });
await cp('dist', 'site/games/PULSE_CHAIN', { recursive: true });
await writeFile(
  'site/_headers',
  `${base}*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\n${base}sw.js\n  Cache-Control: no-cache\n${base}assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
);
console.log('Packaged dist/ and site/games/PULSE_CHAIN/; offline shell ' + build);
