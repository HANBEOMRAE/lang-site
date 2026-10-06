/* sw.js — 오프라인(PWA). 한 번 열면 인터넷 없이도 열린다.
   - 처음 설치할 때 PRECACHE(화면 파일·데이터 전체)를 저장한다.
   - 그 뒤로는 저장해 둔 것을 먼저 보여 주고, 페이지가 열릴 때마다 뒤에서 새 버전을 확인한다.
     새 버전은 STAGE_CACHE에 전부 받아 두고 화면에 "새 버전으로 업데이트됐어요" 알림을 띄운다(app.js).
     실제 교체는 다음에 페이지를 열 때 한꺼번에 한다. 옛 코드가 새 데이터를 읽는 일이 없게 하려는 것.
   - Google 글꼴은 우리 데이터에 쓰인 글자를 담은 조각만 뒤에서 내려받아 저장한다. */

const APP_CACHE = "chotmal-app";
const STAGE_CACHE = "chotmal-app-next";
const STAGE_DONE = "__stage-complete__";   // 새 버전을 빠짐없이 받았다는 표시
const FONT_CACHE = "chotmal-fonts";
// index.html의 글꼴 링크와 같아야 한다 (validate.py가 검사).
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Sans+JP:wght@500;700&display=swap";

// 오프라인용으로 미리 저장할 파일. data/·js/·css/·icons/에 파일을 추가하면 여기에도 넣는다 (validate.py가 검사).
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/core.js",
  "js/views.js",
  "js/app.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "data/en/words.json",
  "data/en/verbs.json",
  "data/en/patterns.json",
  "data/en/situations.json",
  "data/ja/words.json",
  "data/ja/verbs.json",
  "data/ja/particles.json",
  "data/ja/situations.json"
];

// 처음 설치면 바로 저장본으로, 이미 쓰던 중이면(sw.js가 바뀐 경우) 새 버전 칸에 받는다.
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const first = (await (await caches.open(APP_CACHE)).keys()).length === 0;
    const cache = await caches.open(first ? APP_CACHE : STAGE_CACHE);
    await cache.addAll(PRECACHE.map(u => new Request(u, { cache: "reload" })));
    if (!first) await cache.put(STAGE_DONE, new Response("ok"));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) event.respondWith(appFirst(req));
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") event.respondWith(fontFirst(req));
});

// 저장본 먼저. 없으면 받아 오고, 받은 것은 저장해 둔다.
// 페이지를 새로 열 때(navigate) 다 받아 둔 새 버전이 있으면 그때 한꺼번에 바꾼다.
async function appFirst(req) {
  if (req.mode === "navigate") await promoteStage();
  const cache = await caches.open(APP_CACHE);
  const key = req.mode === "navigate" ? "./" : req;
  const hit = await cache.match(key, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function promoteStage() {
  if (!(await caches.has(STAGE_CACHE))) return;
  const stage = await caches.open(STAGE_CACHE);
  if (!(await stage.match(STAGE_DONE))) return;          // 덜 받은 새 버전은 쓰지 않는다
  const app = await caches.open(APP_CACHE);
  for (const req of await stage.keys()) {
    if (req.url.endsWith(STAGE_DONE)) continue;
    await app.put(req, await stage.match(req));
  }
  await caches.delete(STAGE_CACHE);
}

async function fontFirst(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("message", event => {
  if (event.data === "check-update") event.waitUntil(checkUpdate());
  if (event.data === "warm-fonts") event.waitUntil(warmFonts().catch(() => {}));
});

// 저장본을 서버의 것과 비교해, 바뀐 게 있으면 새 버전 전체를 STAGE_CACHE에 받아 두고 알린다.
async function checkUpdate() {
  const app = await caches.open(APP_CACHE);
  const fresh = [];
  let changed = false;
  try {
    for (const u of PRECACHE) {
      const res = await fetch(u, { cache: "no-cache" });
      if (!res.ok) return;                                  // 하나라도 못 받으면 이번엔 그만둔다
      const old = await app.match(u);
      if (!old || !(await sameBody(old, res.clone()))) changed = true;
      fresh.push([u, res]);
    }
  } catch { return; }                                       // 오프라인
  if (!changed) return;
  await caches.delete(STAGE_CACHE);
  const stage = await caches.open(STAGE_CACHE);
  for (const [u, res] of fresh) await stage.put(u, res);
  await stage.put(STAGE_DONE, new Response("ok"));
  for (const c of await self.clients.matchAll()) c.postMessage({ type: "updated" });
}

async function sameBody(a, b) {
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  if (x.byteLength !== y.byteLength) return false;
  const p = new Uint8Array(x), q = new Uint8Array(y);
  for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return false;
  return true;
}

// 글꼴 CSS를 읽어, 우리 데이터·화면에 쓰인 글자를 담은 조각(woff2)만 저장한다.
async function warmFonts() {
  const fonts = await caches.open(FONT_CACHE);
  let cssRes = await fonts.match(FONT_CSS, { ignoreVary: true });
  if (!cssRes) {
    cssRes = await fetch(FONT_CSS, { mode: "cors" });
    if (!cssRes.ok) return;
    await fonts.put(FONT_CSS, cssRes.clone());
  }
  const css = await cssRes.text();

  const app = await caches.open(APP_CACHE);
  const used = new Set();   // 지금 저장본에 쓰인 글자 (새 버전이 적용되면 다음번에 새 글자도 받는다)
  for (const u of PRECACHE) {
    if (!/\.(json|js|html)$|\/$/.test(u)) continue;
    const r = await app.match(u);
    if (r) for (const ch of await r.text()) used.add(ch.codePointAt(0));
  }

  const want = [];
  for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
    const src = block.match(/url\((https:[^)]+)\)/);
    const range = block.match(/unicode-range:\s*([^;]+);/);
    if (src && (!range || covers(range[1], used))) want.push(src[1]);
  }
  const missing = [];
  for (const u of want) if (!(await fonts.match(u))) missing.push(u);
  // 한 번에 여섯 개씩 받는다
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(missing.slice(i, i + 6).map(async u => {
      try { const r = await fetch(u, { mode: "cors" }); if (r.ok) await fonts.put(u, r); } catch {}
    }));
  }
}

function covers(rangeText, used) {
  for (const part of rangeText.split(",")) {
    const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
    const lo = parseInt(a.replace(/\?/g, "0"), 16);
    const hi = parseInt((b || a).replace(/\?/g, "F"), 16);
    for (const cp of used) if (cp >= lo && cp <= hi) return true;
  }
  return false;
}
