/* views.js — 화면 그리기 */

// ── 설정: 뜻 가리기(반복 학습용) ─────────────────
// 켜면 한글 발음과 뜻이 가려지고, 눌러야 보인다.
const settings = {
  get hide() { try { return localStorage.getItem("hideMeaning") === "1"; } catch { return false; } },
  set hide(v) { try { localStorage.setItem("hideMeaning", v ? "1" : "0"); } catch {} }
};
function hideToggle() {
  return `<button class="chip toggle ${settings.hide ? "on" : ""}" id="hideToggle" aria-pressed="${settings.hide}">
    ${settings.hide ? "뜻 가리기 켜짐" : "뜻 가리기"}</button>`;
}
function bindHideToggle(rerender) {
  const b = document.getElementById("hideToggle");
  if (b) b.onclick = () => { settings.hide = !settings.hide; rerender(); };
  // 가려진 부분을 누르면 보이기
  app.querySelectorAll(".hideable").forEach(el =>
    el.addEventListener("click", ev => { ev.stopPropagation(); el.classList.add("shown"); }));
}
const H = () => (settings.hide ? "hideable" : "");

// ── 이어서 하기: 언어별 마지막으로 본 공부 화면 ──────
// 번호가 아니라 이름으로 저장한다(패턴·단어를 중간에 추가해도 같은 곳을 찾게).
// 저장: { en: { ref: { sec, kind, ... }, time }, ja: {...} }
//   kind: card(category, text) | pattern(pattern, fill) | compare(id) | scene(scene) | verb(text) | particle(text)
// 열 때 지금 데이터에서 번호를 찾아 주소를 만든다. 예전 형식(번호만 저장)이나 찾을 수 없는 기록은 조용히 무시한다.
function remember(lang, ref) {
  const all = store.get("lastPlace", {});
  const next = all && typeof all === "object" && !Array.isArray(all) ? all : {};
  next[lang] = { ref, time: Date.now() };
  store.set("lastPlace", next);
}
async function resolvePlace(lang, ref) {
  const L = LANGS[lang];
  const sec = ref && L.sections.find(s => s.id === ref.sec && s.ready);
  if (!sec) return null;
  const base = `#/${lang}/${sec.id}`, head = `${L.name} · ${sec.name}`;
  try {
    const data = await loadData(lang, sec.id);
    if (ref.kind === "card") {
      const ci = data.findIndex(c => c.category === ref.category);
      const ii = ci < 0 ? -1 : data[ci].items.findIndex(x => x.text === ref.text);
      return ii < 0 ? null : { hash: `${base}/${ci}/${ii}`, label: `${head} · ${ref.category} ${ii + 1}/${data[ci].items.length}` };
    }
    if (ref.kind === "pattern") {
      const pi = data.findIndex(p => p.pattern === ref.pattern);
      const fi = pi < 0 ? -1 : data[pi].fills.findIndex(f => f.text === ref.fill);
      return fi < 0 ? null : { hash: `${base}/${pi}/${fi}`, label: `${head} · ${ref.pattern} ${fi + 1}/${data[pi].fills.length}` };
    }
    if (ref.kind === "compare") {
      const list = sec.type === "patterns" ? (await loadData(lang, "pattern_compare")).compare : data.compare;
      const k = list.findIndex(c => c.id === ref.id);
      return k < 0 ? null : { hash: `${base}/vs/${k}`, label: `${head} · ${list[k].title} 비교` };
    }
    if (ref.kind === "scene") {
      const si = data.findIndex(s => s.scene === ref.scene);
      return si < 0 ? null : { hash: `${base}/${si}`, label: `${head} · ${ref.scene}` };
    }
    if (ref.kind === "verb" || ref.kind === "particle") {
      const list = ref.kind === "verb" ? data.verbs : data.particles;
      const i = list.findIndex(x => x.text === ref.text);
      return i < 0 ? null : { hash: `${base}/${i}`, label: `${head} · ${ref.text} ${i + 1}/${list.length}` };
    }
  } catch {}
  return null;
}
async function resolvedPlaces(onlyLang) {
  const all = store.get("lastPlace", {});
  const entries = Object.entries(all && typeof all === "object" ? all : {})
    .filter(([lang, p]) => LANGS[lang] && (!onlyLang || lang === onlyLang) && p && p.ref && typeof p.ref === "object")
    .sort((a, b) => (b[1].time || 0) - (a[1].time || 0));
  const out = [];
  for (const [lang, p] of entries) {
    const r = await resolvePlace(lang, p.ref);
    if (r) out.push([lang, r]);
  }
  return out;
}
function continueRow(lang, p) {
  return `<button class="row continue" style="--accent: var(--${lang})" data-go="${esc(p.hash)}">
      <span class="em" aria-hidden="true">▶</span>
      <span class="label"><strong>이어서 하기</strong><small>${esc(p.label)}</small></span>
    </button>`;
}
// 화면을 먼저 그리고, 기록을 찾으면 그 자리(#continueList)에 버튼을 채운다. 그 사이 화면을 떠났으면 그만둔다.
function fillContinue(onlyLang) {
  const box = document.getElementById("continueList");
  if (!box) return;
  resolvedPlaces(onlyLang).then(list => {
    if (!box.isConnected || !list.length) return;
    box.innerHTML = list.map(([lang, p]) => continueRow(lang, p)).join("");
    box.hidden = false;
  });
}

// ── 첫 화면: 언어 고르기 ─────────────────────────
function viewHome() {
  document.body.className = "";
  setHeader("첫말", null);
  app.innerHTML = `
    <p class="hello">오늘은 어떤 말을<br>배워 볼까요?</p>
    <div class="list continue-list" id="continueList" hidden></div>
    <p class="hello-sub">언어를 고르면 그 언어만 보여요.</p>
    <div class="lang-pick">
      ${Object.entries(LANGS).map(([id, L]) => `
        <button class="lang-btn ${id}" data-go="#/${id}">
          <span class="big">${L.big}</span>
          <span><span class="name">${L.name}</span><span class="desc">${L.desc}</span></span>
        </button>`).join("")}
    </div>`;
  fillContinue();
}

// ── 언어 홈: 섹션 목록 ───────────────────────────
function viewLang(lang) {
  const L = LANGS[lang];
  document.body.className = `lang-${lang}`;
  setHeader(L.name, "#/");
  app.innerHTML = `
    <div class="list continue-list" id="continueList" hidden></div>
    <p class="lead">위에서부터 차례로 공부해요.</p>
    <div class="list">
      ${L.sections.map((s, i) => `
        <button class="row" ${s.ready ? `data-go="#/${lang}/${s.id}"` : "disabled"}>
          <span class="step">${i + 1}</span>
          <span class="label"><strong>${s.name}</strong><small>${s.ready ? s.desc : "준비 중"}</small></span>
        </button>`).join("")}
    </div>
    <h2 class="group">복습</h2>
    <div class="list">
      <button class="row star-row" data-go="#/${lang}/stars">
        <span class="em" aria-hidden="true">★</span>
        <span class="label"><strong>헷갈린 단어</strong>
          <small>☆ 표시한 카드 ${starList().filter(k => k.startsWith(`${lang}/`)).length}개</small></span>
      </button>
    </div>`;
  fillContinue(lang);
}

// ── 카드형(기초 단어·동사): 주제 목록 ─────────────
async function viewCategories(lang, sec) {
  setHeader(sec.name, `#/${lang}`);
  app.innerHTML = `<p class="lead">불러오는 중…</p>`;
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const total = data.reduce((a, c) => a + c.items.length, 0);
  app.innerHTML = `
    <p class="lead">주제를 고르세요. 모두 ${total}개예요.</p>
    <div class="list">
      ${data.map((c, i) => `
        <button class="row" data-go="#/${lang}/${sec.id}/${i}">
          <span class="em" aria-hidden="true">${c.emoji || "📘"}</span>
          <span class="label"><strong>${esc(c.category)}</strong></span>
          <span class="count">${c.items.length}개</span>
        </button>`).join("")}
    </div>`;
}

// ── 카드형: 카드 한 장씩 ─────────────────────────
async function viewCards(lang, sec, catIdx, itemIdx) {
  const L = LANGS[lang];
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const cat = data[catIdx];
  if (!cat) { location.hash = `#/${lang}/${sec.id}`; return; }
  const n = cat.items.length;
  const i = Math.min(Math.max(itemIdx || 0, 0), n - 1);
  const it = cat.items[i];
  const base = `#/${lang}/${sec.id}/${catIdx}`;
  setHeader(cat.category, `#/${lang}/${sec.id}`);
  remember(lang, { sec: sec.id, kind: "card", category: cat.category, text: it.text });

  const key = starKey(lang, sec.id, cat.category, it.text);
  app.innerHTML = `
    <div class="viewer">
      <div class="tools">${progressBar(i, n)}${hideToggle()}</div>
      ${cardHTML(lang, it, key)}
      ${navHTML(i, n)}
    </div>`;

  const go = j => { location.hash = `${base}/${(j + n) % n}`; };
  bindCard(lang, it, key, () => go(i === n - 1 ? 0 : i + 1), () => { if (i > 0) go(i - 1); });
  bindHideToggle(() => viewCards(lang, sec, catIdx, i));
}

// 단어 카드 한 장 (주제 카드·헷갈린 단어 모음이 함께 쓴다)
function cardHTML(lang, it, key) {
  return `
      <article class="card" id="card">
        ${starButton(key)}
        <p class="word" lang="${lang}">${wordHTML(it.text)}</p>
        ${it.kanji ? `<p class="kanji-big" lang="${lang}">${esc(it.kanji)}</p>` : ""}
        <div class="${H()}">
          <p class="pron">${esc(it.ko_pron)}</p>
          <p class="meaning">${esc(it.meaning)}</p>
        </div>
        <button class="speak" id="speakWord" aria-label="${esc(it.text)} 발음 듣기">🔊</button>
        ${sayToolsHTML("sayWord")}
        ${it.note ? `<p class="note">${noBreakJa(it.note)}</p>` : ""}
        ${it.example ? `
          <div class="example">
            <p><span class="en-line" lang="${lang}">${esc(it.example)}</span><br>
               ${it.example_ko_pron ? `<span class="pron-s ${H()}">${esc(it.example_ko_pron)}</span>` : ""}
               <span class="ko-line ${H()}">${esc(it.example_meaning)}</span></p>
            <button class="mini-speak" id="speakEx" aria-label="예문 듣기">🔊</button>
          </div>
          ${sayToolsHTML("sayEx", true)}` : ""}
      </article>`;
}
function navHTML(i, n) {
  return `
      <div class="nav">
        <button id="prev" ${i === 0 ? "disabled" : ""}>이전</button>
        <button id="next" class="primary">${i === n - 1 ? "처음부터" : "다음"}</button>
      </div>`;
}
function bindCard(lang, it, key, next, prev) {
  const voice = LANGS[lang].voice;
  document.getElementById("speakWord").onclick = e => tts.speak(it.text, voice, e.currentTarget);
  const ex = document.getElementById("speakEx");
  if (ex) ex.onclick = e => tts.speak(it.example, voice, e.currentTarget);
  document.getElementById("prev").onclick = prev;
  document.getElementById("next").onclick = next;
  addSwipe(document.getElementById("card"), next, prev);
  bindSayTools(document.getElementById("sayWord"), lang, [it.text, it.kanji]);
  bindSayTools(document.getElementById("sayEx"), lang, [it.example, it.example_kanji_text]);
  bindStar(key);
  fitWord();
}

// ── 따라 말하기 🎤 ─────────────────────────────────
// 정답 표기(일본어는 히라가나·한자 둘 다)와 인식 결과를 띄어쓰기·문장부호·대소문자 무시하고 비교한다(speech.js).
function sayToolsHTML(id, compact = false, label = compact ? "예문 따라 말하기" : "따라 말하기") {
  if (!speech.supported()) return "";      // 인식기가 없는 브라우저: 🎤를 숨긴다
  return `<div class="say-tools${compact ? " compact" : ""}" id="${id}">
      <button class="chip mic" aria-label="${label}">🎤 ${label}</button>
      <p class="say-result" aria-live="polite"></p>
    </div>`;
}
function bindSayTools(box, lang, answers) {
  if (!box) return;
  const btn = box.querySelector(".mic"), out = box.querySelector(".say-result");
  const ans = answers.filter(Boolean).map(plainText);
  btn.onclick = e => { e.stopPropagation(); runMic(btn, out, lang, ans); };
}
const MIC_ERRORS = {
  "not-allowed": "마이크 사용을 허락해야 해요 (브라우저 설정에서 바꿀 수 있어요).",
  "service-not-allowed": "이 브라우저에서는 음성 인식을 쓸 수 없어요.",
  "audio-capture": "마이크를 찾을 수 없어요.",
  "network": "인터넷이 필요해요. 음성 인식은 온라인에서만 돼요.",
  "no-speech": "소리가 안 들렸어요. 다시 해 봐요.",
  "unsupported": "이 브라우저는 음성 인식을 지원하지 않아요."
};
const LEVELS = { ok: "맞았어요!", close: "거의 맞았어요", retry: "다시 해 봐요" };
async function runMic(btn, out, lang, answers) {
  if (btn.classList.contains("listening")) { speech.stop(); return; }
  if (!navigator.onLine) { out.textContent = MIC_ERRORS.network; return; }
  if (!(await speechNotice())) return;
  tts.stop();
  btn.classList.add("listening");
  out.textContent = "듣는 중… 말해 보세요";
  try {
    const alts = await speech.listen(LANGS[lang].voice);
    const j = speech.judge(lang, alts, answers);
    out.innerHTML = `<span class="lv lv-${j.level}">${LEVELS[j.level]}</span>
      이렇게 들렸어요: “<span lang="${lang}">${esc(j.heard)}</span>”`;
  } catch (e) {
    out.textContent = e.message === "aborted" ? "" : (MIC_ERRORS[e.message] || "다시 해 봐요.");
  } finally {
    btn.classList.remove("listening");
  }
}
// 처음 한 번: 음성이 서버로 간다는 안내
function speechNotice() {
  if (store.get("speechNotice", false)) return Promise.resolve(true);
  return new Promise(resolve => {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="noticeTitle">
        <h2 id="noticeTitle">따라 말하기 안내</h2>
        <p>따라 말하기는 브라우저에 들어 있는 음성 인식을 써요. 말한 소리가 <strong>Google 서버로 전송</strong>돼서 글자로 바뀌어요.
           그래서 인터넷이 있어야 해요. (⏺ 녹음은 휴대폰 밖으로 나가지 않아요.)</p>
        <div class="nav"><button id="noticeNo">취소</button><button class="primary" id="noticeOk">알겠어요</button></div>
      </div>`;
    document.body.appendChild(back);
    const close = ok => { back.remove(); if (ok) store.set("speechNotice", true); resolve(ok); };
    back.querySelector("#noticeOk").onclick = () => close(true);
    back.querySelector("#noticeNo").onclick = () => close(false);
    back.querySelector("#noticeOk").focus();
  });
}
// 목록(대화·핵심 문장·조사 예문)에서는 누른 문장 바로 아래에만 도구를 붙인다
function attachInlineTools(afterEl, lang, answers, alignEnd = false) {
  speech.stop();
  document.querySelectorAll(".say-tools.inline").forEach(t => t.remove());
  if (!speech.supported()) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = sayToolsHTML("sayInline", true, "따라 말하기");
  const box = wrap.firstElementChild;
  box.classList.add("inline");
  if (alignEnd) box.classList.add("end");
  afterEl.after(box);
  bindSayTools(box, lang, answers);
}

// ── 헷갈린 단어 ☆ ─────────────────────────────────
// 카드 번호가 아니라 내용으로 저장한다: "언어/섹션/주제/단어" (동사 변형은 주제 자리에 "-").
// 번호로 저장하면 단어를 추가할 때 다른 카드로 바뀐다. 주제까지 넣는 건 はな(코)·はな(꽃) 때문.
function starKey(lang, secId, category, text) { return `${lang}/${secId}/${category}/${text}`; }
function starList() {
  const v = store.get("stars", []);
  return Array.isArray(v) ? v.filter(k => typeof k === "string") : [];
}
function starButton(key) {
  const on = starList().includes(key);
  return `<button class="star-btn ${on ? "on" : ""}" id="starBtn" aria-pressed="${on}"
    aria-label="헷갈린 단어로 표시">${on ? "★" : "☆"}</button>`;
}
function bindStar(key) {
  const b = document.getElementById("starBtn");
  if (!b) return;
  b.onclick = e => {
    e.stopPropagation();
    const list = starList();
    const on = !list.includes(key);
    store.set("stars", on ? [...list, key] : list.filter(k => k !== key));
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
    b.textContent = on ? "★" : "☆";
    toast(on ? "헷갈린 단어에 넣었어요" : "헷갈린 단어에서 뺐어요");
  };
}

// 모아 보기 화면에서 ★를 풀어도 지금 넘기던 순서는 그대로 둔다. 다른 화면으로 나가면 비운다(app.js).
let starSnap = null;

async function viewStars(lang, idx) {
  const L = LANGS[lang];
  setHeader("헷갈린 단어", `#/${lang}`);
  if (!starSnap || starSnap.lang !== lang) {
    starSnap = { lang, keys: starList().filter(k => k.startsWith(`${lang}/`)) };
  }
  // 표시를 실제 카드로 바꾼다. 찾을 수 없는 표시(주제 이름이 바뀌었거나 지워진 단어)는 따로 센다.
  const cards = [], missing = [];
  for (const key of starSnap.keys) {
    const [, secId, category, ...rest] = key.split("/");
    const text = rest.join("/");
    const sec = L.sections.find(s => s.id === secId && s.ready);
    let data = null, found = null;
    if (sec) { try { data = await loadData(lang, sec.id); } catch {} }
    if (data && sec.type === "cards") {
      const cat = data.find(c => c.category === category);
      const it = cat && cat.items.find(x => x.text === text);
      if (it) found = { it, src: `${sec.name} · ${cat.category}` };
    } else if (data && sec.type === "conjugation") {
      const v = data.verbs.find(x => x.text === text);
      if (v) found = { src: sec.name, it: { text: v.text, kanji: v.kanji, ko_pron: v.ko_pron, meaning: v.meaning, note: v.note,
        example: v.example?.text, example_ko_pron: v.example?.ko_pron, example_kanji_text: v.example?.kanji_text, example_meaning: v.example?.meaning } };
    }
    if (found) cards.push({ key, ...found }); else missing.push(key);
  }
  const missingHTML = missing.length ? `
    <p class="lead missing">찾을 수 없는 표시 ${missing.length}개 · <button class="chip" id="dropMissing">지우기</button></p>` : "";

  if (!cards.length) {
    app.innerHTML = `${missingHTML}
      <p class="lead">아직 ☆ 표시한 단어가 없어요.<br>단어 카드 오른쪽 위 ☆를 누르면 여기에 모여요.</p>`;
  } else {
    const n = cards.length;
    const i = Math.min(Math.max(idx || 0, 0), n - 1);
    const c = cards[i];
    app.innerHTML = `
      <div class="viewer">
        ${missingHTML}
        <div class="tools">${progressBar(i, n)}${hideToggle()}</div>
        <p class="star-src">${esc(c.src)}</p>
        ${cardHTML(lang, c.it, c.key)}
        ${navHTML(i, n)}
      </div>`;
    const go = j => { location.hash = `#/${lang}/stars/${(j + n) % n}`; };
    bindCard(lang, c.it, c.key, () => go(i === n - 1 ? 0 : i + 1), () => { if (i > 0) go(i - 1); });
    bindHideToggle(() => viewStars(lang, i));
  }
  const drop = document.getElementById("dropMissing");
  if (drop) drop.onclick = () => {
    store.set("stars", starList().filter(k => !missing.includes(k)));
    starSnap.keys = starSnap.keys.filter(k => !missing.includes(k));
    viewStars(lang, idx);
  };
}

// ── 큰 글자 맞춤 ─────────────────────────────────
// 단어(띄어쓰기 단위)마다 줄이 안 바뀌게 감싼다. 먼저 한 줄로 두고 WORD_MIN까지 줄여 보고,
// 그래도 넘치면 띄어쓰기 자리에서 줄을 바꾼 뒤 다시 맞춘다 (in front of, ありがとう ございます).
// 띄어쓰기가 없거나, 줄을 바꿔도 한 단어가 넘치면 WORD_MIN 밑으로 더 줄인다 (넘치거나 단어 중간에서 끊기지 않게).
const WORD_MIN = 36;    // px. 360px 화면에서 띄어쓰기 없는 단어가 모두 이 크기 이상으로 들어간다
const WORD_FLOOR = 8;   // px. 더 줄일 때의 마지막 한계 (끝없이 줄지 않게)
function wordHTML(text) {
  return String(text).split(" ").map(w => `<span class="nobr">${esc(w)}</span>`).join(" ");
}
function fitWord() {
  const el = app.querySelector(".word");
  if (!el) return;
  const fits = () => el.scrollWidth <= el.clientWidth + 1;
  const shrink = floor => {
    el.style.fontSize = "";
    let fs = parseFloat(getComputedStyle(el).fontSize);
    while (!fits() && fs - 1 >= floor) { fs -= 1; el.style.fontSize = `${fs}px`; }
  };
  el.classList.add("one-line");
  shrink(WORD_MIN);
  if (fits()) return;
  if (el.textContent.includes(" ")) el.classList.remove("one-line");  // 띄어쓰기 자리에서 줄바꿈 허용
  shrink(WORD_FLOOR);
}
window.addEventListener("resize", fitWord);

// ── 패턴: 목록 ──────────────────────────────────
async function viewPatternList(lang, sec) {
  setHeader(sec.name, `#/${lang}`);
  app.innerHTML = `<p class="lead">불러오는 중…</p>`;
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  let cmp = null;   // 비슷한 패턴 비교 (없는 언어면 건너뜀)
  try { cmp = await loadData(lang, "pattern_compare"); } catch {}
  const groups = [...new Set(data.map(p => p.group))];
  app.innerHTML = `
    <p class="lead">틀 하나에 말을 바꿔 넣으며 반복해요.</p>
    ${groups.map(g => `
      <h2 class="group">${esc(g)}</h2>
      <div class="list">
        ${data.map((p, i) => p.group !== g ? "" : `
          <button class="row" data-go="#/${lang}/${sec.id}/${i}">
            <span class="label"><strong lang="${lang}">${esc(p.pattern)}</strong><small>${esc(p.meaning)}</small></span>
            <span class="count">${p.fills.length}문장</span>
          </button>`).join("")}
      </div>`).join("")}
    ${cmp ? `
      <h2 class="group">비슷한 패턴 비교</h2>
      <div class="list">
        ${cmp.compare.map((c, k) => `
          <button class="row" data-go="#/${lang}/${sec.id}/vs/${k}">
            <span class="em" aria-hidden="true">⚖️</span>
            <span class="label"><strong lang="${lang}">${esc(c.title)}</strong><small>${c.points.map(esc).join(" / ")}</small></span>
          </button>`).join("")}
      </div>` : ""}`;
}

// ── 패턴: 문장 연습 ─────────────────────────────
async function viewPattern(lang, sec, pIdx, fIdx) {
  const L = LANGS[lang];
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const p = data[pIdx];
  if (!p) { location.hash = `#/${lang}/${sec.id}`; return; }
  const n = p.fills.length;
  const i = Math.min(Math.max(fIdx || 0, 0), n - 1);
  const f = p.fills[i];
  const sentence = p.pattern.replace("___", f.text);
  const [before, after] = p.pattern.split("___");
  const pron = p.ko_pron.replace("___", f.ko_pron);
  const base = `#/${lang}/${sec.id}/${pIdx}`;
  const last = i === n - 1;
  const hasNextPattern = pIdx < data.length - 1;
  setHeader(p.meaning, `#/${lang}/${sec.id}`);
  remember(lang, { sec: sec.id, kind: "pattern", pattern: p.pattern, fill: f.text });

  app.innerHTML = `
    <div class="viewer">
      <div class="tools">${progressBar(i, n)}${hideToggle()}</div>
      <p class="frame" lang="${lang}">${esc(before)}<span class="slot">?</span>${esc(after)}
        ${p.tip ? `<small>${esc(p.tip)}</small>` : ""}</p>
      <article class="card" id="card">
        <p class="sentence" lang="${lang}">${sentenceHTML(p.pattern, f.text)}</p>
        <div class="${H()}">
          <p class="pron">${esc(pron)}</p>
          <p class="meaning">${esc(f.meaning)}</p>
        </div>
        <button class="speak" id="speak" aria-label="문장 듣기">🔊</button>
        ${sayToolsHTML("saySentence")}
      </article>
      <div class="chips" aria-label="바꿔 넣을 말">
        ${p.fills.map((x, j) => `<button class="chip ${j === i ? "on" : ""}" data-go="${base}/${j}" lang="${lang}">${esc(x.text)}</button>`).join("")}
      </div>
      <div class="nav">
        <button id="prev" ${i === 0 ? "disabled" : ""}>이전</button>
        <button id="next" class="primary">${last ? (hasNextPattern ? "다음 패턴" : "처음부터") : "다음"}</button>
      </div>
    </div>`;

  const next = () => {
    if (!last) location.hash = `${base}/${i + 1}`;
    else location.hash = hasNextPattern ? `#/${lang}/${sec.id}/${pIdx + 1}/0` : `${base}/0`;
  };
  const prev = () => { if (i > 0) location.hash = `${base}/${i - 1}`; };
  document.getElementById("speak").onclick = e => tts.speak(sentence, L.voice, e.currentTarget);
  document.getElementById("prev").onclick = prev;
  document.getElementById("next").onclick = next;
  addSwipe(document.getElementById("card"), next, prev);
  bindWordGloss(lang, p, f);
  bindSayTools(document.getElementById("saySentence"), lang, [sentence]);
  bindHideToggle(() => viewPattern(lang, sec, pIdx, i));
}

// ── 단어별 뜻 (누를 때만 보인다) ───────────────────
// 틀 자리 단어는 p.words, 바꿔 넣는 말 자리 단어는 f.words → 없으면 p.words(기본값).
// "I want to go to the park"처럼 같은 단어(to)라도 자리에 따라 뜻이 다르다.
const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'\-]*/g;
function sentenceHTML(pattern, fillText) {
  const s = pattern.replace("___", fillText);
  const fs = pattern.indexOf("___"), fe = fs + fillText.length;
  const toks = [...s.matchAll(WORD_RE)].map(m => ({ a: m.index, b: m.index + m[0].length, key: m[0].toLowerCase() }))
    .map(t => ({ ...t, inFill: t.a < fe && t.b > fs }));
  // 앞부분·바꿔 넣는 말·뒷부분으로 나눠 그린다. eating처럼 경계를 넘는 단어는 두 조각 모두 같은 단어로 묶는다.
  const piece = (a, b) => {
    let out = "", pos = a;
    for (const t of toks) {
      const x = Math.max(t.a, a), y = Math.min(t.b, b);
      if (x >= y) continue;
      out += esc(s.slice(pos, x));
      out += `<span class="w" role="button" tabindex="0" data-k="${esc(t.key)}" data-f="${t.inFill ? 1 : 0}"
        data-word="${esc(s.slice(t.a, t.b))}">${esc(s.slice(x, y))}</span>`;
      pos = y;
    }
    return out + esc(s.slice(pos, b));
  };
  return `${piece(0, fs)}<span class="fill">${piece(fs, fe)}</span>${piece(fe, s.length)}`;
}

function closeGloss() { document.querySelectorAll(".gloss").forEach(g => g.remove()); }
document.addEventListener("click", e => { if (!e.target.closest(".w, .gloss")) closeGloss(); });

function bindWordGloss(lang, p, f) {
  const card = document.getElementById("card");
  const lookup = (k, inFill) => {
    const pw = p.words || {}, fw = f.words || {};
    return inFill ? (fw[k] || pw[k]) : pw[k];
  };
  card.querySelectorAll(".w").forEach(el => {
    const open = e => {
      e.stopPropagation();
      const wasOpen = card.querySelector(`.gloss[data-k="${el.dataset.k}"][data-f="${el.dataset.f}"]`);
      closeGloss();
      if (wasOpen) return;                                   // 같은 단어를 다시 누르면 닫기
      const g = lookup(el.dataset.k, el.dataset.f === "1");
      if (!g) return;
      const box = document.createElement("div");
      box.className = "gloss"; box.dataset.k = el.dataset.k; box.dataset.f = el.dataset.f;
      box.innerHTML = `<span class="g-text"><b lang="${lang}">${esc(el.dataset.word)}</b>
          <span class="g-pron">${esc(g.ko_pron)}</span><span class="g-mean">${esc(g.meaning)}</span></span>
        <button class="mini-speak" aria-label="${esc(el.dataset.word)} 발음 듣기">🔊</button>`;
      card.appendChild(box);
      box.querySelector("button").onclick = ev => { ev.stopPropagation(); tts.speak(el.dataset.word, LANGS[lang].voice, ev.currentTarget); };
      // 누른 단어 바로 아래, 카드 안쪽에 맞춘다
      const cr = card.getBoundingClientRect(), wr = el.getBoundingClientRect();
      const w = box.offsetWidth;
      const left = Math.min(Math.max(wr.left - cr.left + wr.width / 2 - w / 2, 8), cr.width - w - 8);
      box.style.left = `${left}px`;
      box.style.top = `${wr.bottom - cr.top + 6}px`;
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } });
  });
}

// ── 상황별 회화: 장면 목록 ───────────────────────
async function viewSceneList(lang, sec) {
  setHeader(sec.name, `#/${lang}`);
  app.innerHTML = `<p class="lead">불러오는 중…</p>`;
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  app.innerHTML = `
    <p class="lead">장면을 고르세요. 대화를 듣고 따라 말해 보세요.</p>
    <div class="list">
      ${data.map((s, i) => `
        <button class="row" data-go="#/${lang}/${sec.id}/${i}">
          <span class="em" aria-hidden="true">${s.emoji || "💬"}</span>
          <span class="label"><strong>${esc(s.scene)}</strong><small>${esc(s.desc)}</small></span>
        </button>`).join("")}
    </div>`;
}

// ── 상황별 회화: 대화와 핵심 문장 ────────────────
async function viewScene(lang, sec, sIdx) {
  const L = LANGS[lang];
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const s = data[sIdx];
  if (!s) { location.hash = `#/${lang}/${sec.id}`; return; }
  setHeader(s.scene, `#/${lang}/${sec.id}`);
  remember(lang, { sec: sec.id, kind: "scene", scene: s.scene });

  const line = (l, d, k) => `
    <button class="bubble ${l.who === "나" ? "me" : ""}" data-d="${d}" data-k="${k}">
      <span class="who">${esc(l.who)}</span>
      <span class="say" lang="${lang}">${esc(l.text)}</span>
      <span class="${H()}"><span class="pron-s">${esc(l.ko_pron)}</span>
      <span class="mean-s">${esc(l.meaning)}</span></span>
    </button>`;

  app.innerHTML = `
    <div class="tools">${hideToggle()}</div>
    ${s.dialogues.map((d, di) => `
      <section class="dialogue">
        <div class="d-head">
          <h2 class="group">${esc(d.title)}</h2>
          <button class="chip play" data-play="${di}">▶ 전체 듣기</button>
        </div>
        <div class="talk">${d.lines.map((l, k) => line(l, di, k)).join("")}</div>
      </section>`).join("")}
    <h2 class="group">꼭 필요한 문장</h2>
    <div class="list">
      ${s.phrases.map((ph, k) => `
        <button class="row phrase" data-ph="${k}">
          <span class="label"><strong lang="${lang}">${esc(ph.text)}</strong>
            <small class="${H()}">${esc(ph.ko_pron)} · ${esc(ph.meaning)}</small></span>
          <span class="mini-speak" aria-hidden="true">🔊</span>
        </button>`).join("")}
    </div>
    ${sIdx < data.length - 1 ? `<div class="nav"><button class="primary" data-go="#/${lang}/${sec.id}/${sIdx + 1}">다음 장면: ${esc(data[sIdx + 1].scene)}</button></div>` : ""}`;

  const clearActive = () => app.querySelectorAll(".bubble.active").forEach(b => b.classList.remove("active"));
  app.querySelectorAll(".bubble").forEach(b => b.addEventListener("click", () => {
    clearActive(); b.classList.add("active");
    const ln = s.dialogues[b.dataset.d].lines[b.dataset.k];
    tts.speak(ln.text, L.voice);
    attachInlineTools(b, lang, [ln.text, ln.kanji_text], b.classList.contains("me"));
  }));
  app.querySelectorAll("[data-play]").forEach(b => b.addEventListener("click", () => {
    const di = Number(b.dataset.play);
    const bubbles = app.querySelectorAll(`.bubble[data-d="${di}"]`);
    tts.speakAll(s.dialogues[di].lines.map(l => l.text), L.voice,
      k => { clearActive(); bubbles[k].classList.add("active"); bubbles[k].scrollIntoView({ block: "nearest", behavior: "smooth" }); },
      clearActive);
  }));
  app.querySelectorAll("[data-ph]").forEach(b => b.addEventListener("click", () => {
    const ph = s.phrases[b.dataset.ph];
    tts.speak(ph.text, L.voice);
    attachInlineTools(b, lang, [ph.text, ph.kanji_text]);
  }));
  bindHideToggle(() => viewScene(lang, sec, sIdx));
}

// ── 동사 변형: 그룹별 전체 표 ────────────────────
async function viewConjTable(lang, sec) {
  setHeader(sec.name, `#/${lang}`);
  app.innerHTML = `<p class="lead">불러오는 중…</p>`;
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const head = `<tr><th scope="col">동사</th>${data.forms.map(f => `<th scope="col">${esc(f.name)}</th>`).join("")}</tr>`;
  const row = (v, i) => `
    <tr data-go="#/${lang}/${sec.id}/${i}">
      <th scope="row">
        <a class="v-link" href="#/${lang}/${sec.id}/${i}"><span class="kana" lang="${lang}">${esc(v.text)}</span>
          ${v.kanji ? `<span class="kanji" lang="${lang}">${esc(v.kanji)}</span>` : ""}</a>
        <span class="mean-s ${H()}">${esc(v.meaning)}</span>
      </th>
      ${data.forms.map(f => {
        const x = v.forms[f.id] || {};
        return `<td><span class="kana" lang="${lang}">${esc(x.text)}</span><span class="pron-s ${H()}">${esc(x.ko_pron)}</span></td>`;
      }).join("")}
    </tr>`;

  app.innerHTML = `
    <div class="tools"><p class="lead conj-hint">줄을 누르면 자세히 봐요. 표는 옆으로 밀려요.</p>${hideToggle()}</div>
    ${data.groups.map(g => {
      const rows = data.verbs.map((v, i) => v.group === g.id ? row(v, i) : "").join("");
      return rows ? `
        <h2 class="group">${esc(g.name)}</h2>
        <p class="lead">${esc(g.desc)}</p>
        <div class="conj-wrap"><table class="conj"><thead>${head}</thead><tbody>${rows}</tbody></table></div>` : "";
    }).join("")}`;
  bindHideToggle(() => viewConjTable(lang, sec));
}

// 일본어(가나·한자) 덩어리가 줄 끝에서 중간에 끊기지 않게 감싼다
function noBreakJa(s) {
  return esc(s).replace(/[぀-ヿ一-鿿]+/g, m => `<span class="nobr">${m}</span>`);
}

// ── 동사 변형: 동사 하나 자세히 ──────────────────
async function viewVerb(lang, sec, vIdx) {
  const L = LANGS[lang];
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const v = data.verbs[vIdx];
  if (!v) { location.hash = `#/${lang}/${sec.id}`; return; }
  const n = data.verbs.length;
  const g = data.groups.find(x => x.id === v.group);
  const base = `#/${lang}/${sec.id}`;
  setHeader(v.text, base);
  remember(lang, { sec: sec.id, kind: "verb", text: v.text });

  app.innerHTML = `
    <div class="tools">${progressBar(vIdx, n)}${hideToggle()}</div>
    <article class="card" id="card">
      ${starButton(starKey(lang, sec.id, "-", v.text))}
      ${g ? `<span class="badge">${esc(g.name)}</span>` : ""}
      <p class="word" lang="${lang}">${wordHTML(v.text)}</p>
      ${v.kanji ? `<p class="kanji-big" lang="${lang}">${esc(v.kanji)}</p>` : ""}
      <div class="${H()}">
        <p class="pron">${esc(v.ko_pron)}</p>
        <p class="meaning">${esc(v.meaning)}</p>
      </div>
      <button class="speak" id="speakWord" aria-label="${esc(v.text)} 발음 듣기">🔊</button>
      ${v.note ? `<p class="note">${noBreakJa(v.note)}</p>` : ""}
    </article>
    <h2 class="group">활용형</h2>
    <div class="list">
      ${data.forms.map((f, k) => {
        const x = v.forms[f.id] || {};
        return `
        <button class="row form-row" data-form="${f.id}">
          <span class="form-name"><strong>${esc(f.name)}</strong><small>${esc(f.desc)}</small></span>
          <span class="label"><strong lang="${lang}">${esc(x.text)}</strong>
            <small class="${H()}">${esc(x.ko_pron)} · ${esc(x.meaning)}</small></span>
          <span class="mini-speak" aria-hidden="true">🔊</span>
        </button>`;
      }).join("")}
    </div>
    ${v.example ? `
      <h2 class="group">예문</h2>
      <div class="example ex-box">
        <p><span class="en-line" lang="${lang}">${esc(v.example.text)}</span>
           <span class="pron-s ${H()}">${esc(v.example.ko_pron)}</span>
           <span class="ko-line ${H()}">${esc(v.example.meaning)}</span></p>
        <button class="mini-speak" id="speakEx" aria-label="예문 듣기">🔊</button>
      </div>` : ""}
    <div class="nav">
      <button id="prev" ${vIdx === 0 ? "disabled" : ""}>이전</button>
      <button id="next" class="primary">${vIdx === n - 1 ? "처음부터" : "다음"}</button>
    </div>`;

  const next = () => { location.hash = `${base}/${vIdx === n - 1 ? 0 : vIdx + 1}`; };
  const prev = () => { if (vIdx > 0) location.hash = `${base}/${vIdx - 1}`; };
  document.getElementById("speakWord").onclick = e => tts.speak(v.text, L.voice, e.currentTarget);
  const ex = document.getElementById("speakEx");
  if (ex) ex.onclick = e => tts.speak(v.example.text, L.voice, e.currentTarget);
  app.querySelectorAll("[data-form]").forEach(b => b.addEventListener("click", () =>
    tts.speak(v.forms[b.dataset.form].text, L.voice)));
  document.getElementById("prev").onclick = prev;
  document.getElementById("next").onclick = next;
  addSwipe(document.getElementById("card"), next, prev);
  bindStar(starKey(lang, sec.id, "-", v.text));
  fitWord();
  bindHideToggle(() => viewVerb(lang, sec, vIdx));
}

// ── 조사 ─────────────────────────────────────────
// 예문의 [조사]는 화면에서는 강조로, 발음 듣기에는 괄호를 뺀 문장으로 넘긴다.
const plainText = s => String(s).replace(/[[\]]/g, "");
const markParticle = s => esc(s).replace(/\[([^\]]+)\]/g, '<span class="fill">$1</span>');

// 예문 한 줄 (누르면 괄호를 뺀 문장을 읽는다)
function exampleRow(lang, ex, extra = "") {
  return `
    <button class="row phrase particle-ex" data-say="${esc(plainText(ex.text))}" data-kanji="${esc(ex.kanji_text || "")}">
      <span class="label">${extra}<strong lang="${lang}">${markParticle(ex.text)}</strong>
        <small class="${H()}">${esc(ex.ko_pron)} · ${esc(ex.meaning)}</small>
        ${ex.why ? `<small class="why">${esc(ex.why)}</small>` : ""}</span>
      <span class="mini-speak" aria-hidden="true">🔊</span>
    </button>`;
}
function bindSay(lang) {
  app.querySelectorAll("[data-say]").forEach(b =>
    b.addEventListener("click", () => {
      tts.speak(b.dataset.say, LANGS[lang].voice);
      attachInlineTools(b, lang, [b.dataset.say, b.dataset.kanji]);
    }));
}

// 목록: 단계별 조사 → 맨 끝에 헷갈리는 조사 비교
async function viewParticleList(lang, sec) {
  setHeader(sec.name, `#/${lang}`);
  app.innerHTML = `<p class="lead">불러오는 중…</p>`;
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  app.innerHTML = `
    <p class="lead">단계 순서대로 익히고, 마지막에 헷갈리는 조사를 비교해요.</p>
    ${data.stages.map(st => `
      <h2 class="group">${esc(st.name)} <small class="group-desc">${esc(st.desc || "")}</small></h2>
      <div class="list">
        ${data.particles.map((p, i) => p.stage !== st.id ? "" : `
          <button class="row" data-go="#/${lang}/${sec.id}/${i}">
            <span class="em kana" lang="${lang}" aria-hidden="true">${esc(p.text)}</span>
            <span class="label"><strong>${esc(p.meaning)}</strong><small>소리: ${esc(p.ko_pron)} · ${esc(p.role)}</small></span>
          </button>`).join("")}
      </div>`).join("")}
    <h2 class="group">헷갈리는 조사</h2>
    <div class="list">
      ${data.compare.map((c, k) => `
        <button class="row" data-go="#/${lang}/${sec.id}/vs/${k}">
          <span class="em" aria-hidden="true">⚖️</span>
          <span class="label"><strong>${esc(c.title)}</strong>
            <small>${c.pair.map(id => `${esc(particleById(data, id).text)}: ${esc(c.points[id])}`).join(" / ")}</small></span>
        </button>`).join("")}
    </div>`;
}
const particleById = (data, id) => data.particles.find(p => p.id === id) || { text: "?" };

// 조사 하나: 큰 글자 카드 + 쓰임별로 묶인 예문 + 관련 비교
async function viewParticle(lang, sec, idx) {
  const L = LANGS[lang];
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const p = data.particles[idx];
  if (!p) { location.hash = `#/${lang}/${sec.id}`; return; }
  const n = data.particles.length;
  const base = `#/${lang}/${sec.id}`;
  setHeader(`조사 ${p.text}`, base);
  remember(lang, { sec: sec.id, kind: "particle", text: p.text });
  const multi = p.uses.length > 1;
  const related = data.compare.map((c, k) => [c, k]).filter(([c]) => c.pair.includes(p.id));

  app.innerHTML = `
    <div class="tools">${progressBar(idx, n)}${hideToggle()}</div>
    <article class="card" id="card">
      <p class="word" lang="${lang}">${wordHTML(p.text)}</p>
      <div class="${H()}">
        <p class="pron">${esc(p.ko_pron)}</p>
        <p class="meaning">${esc(p.meaning)}</p>
      </div>
      <button class="speak" id="speakWord" aria-label="${esc(p.text)} 발음 듣기">🔊</button>
      <p class="role">${esc(p.role)}</p>
      ${p.note ? `<p class="note">${noBreakJa(p.note)}</p>` : ""}
    </article>
    ${p.uses.map(u => `
      ${multi ? `<h2 class="group">${esc(u.name)} <small class="group-desc">${esc(u.desc || "")}</small></h2>`
              : `<h2 class="group">예문</h2>`}
      <div class="list">${u.examples.map(ex => exampleRow(lang, ex)).join("")}</div>`).join("")}
    ${related.length ? `
      <div class="chips related">
        ${related.map(([c, k]) => `<button class="chip" data-go="${base}/vs/${k}">${esc(c.title)} 비교하기</button>`).join("")}
      </div>` : ""}
    <div class="nav">
      <button id="prev" ${idx === 0 ? "disabled" : ""}>이전</button>
      <button id="next" class="primary">${idx === n - 1 ? "비교하러 가기" : "다음"}</button>
    </div>`;

  const next = () => { location.hash = idx === n - 1 ? `${base}/vs/0` : `${base}/${idx + 1}`; };
  const prev = () => { if (idx > 0) location.hash = `${base}/${idx - 1}`; };
  document.getElementById("speakWord").onclick = e => tts.speak(p.text, L.voice, e.currentTarget);
  document.getElementById("prev").onclick = prev;
  document.getElementById("next").onclick = next;
  addSwipe(document.getElementById("card"), next, prev);
  bindSay(lang);
  fitWord();
  bindHideToggle(() => viewParticle(lang, sec, idx));
}

// ── 비교 화면 (조사·패턴이 함께 쓴다) ──────────────
// sides: [{ label, point, big?, practice? }]  examples: [{ tag, text, ko_pron, meaning, why }]
function renderCompare({ lang, sides, examples, next }) {
  app.innerHTML = `
    <div class="tools">${hideToggle()}</div>
    <div class="pair">
      ${sides.map(s => `<div class="pair-side">
          <p class="${s.big ? "pair-kana" : "pair-label"}" lang="${lang}">${esc(s.label)}</p>
          <p class="pair-point">${esc(s.point)}</p>
          ${s.practice ? `<button class="chip practice" data-go="${s.practice}">이 패턴 연습하기</button>` : ""}
        </div>`).join("")}
    </div>
    <h2 class="group">예문</h2>
    <div class="list">
      ${examples.map(ex => exampleRow(lang, ex, `<span class="tag" lang="${lang}">${esc(ex.tag)}</span>`)).join("")}
    </div>
    <div class="nav"><button class="primary" data-go="${next.hash}">${esc(next.label)}</button></div>`;
  bindSay(lang);
}

// 헷갈리는 조사 비교
async function viewCompare(lang, sec, k) {
  const L = LANGS[lang];
  let data;
  try { data = await loadData(lang, sec.id); } catch (e) { return errorView(e); }
  const c = data.compare[k];
  const base = `#/${lang}/${sec.id}`;
  if (!c) { location.hash = base; return; }
  setHeader(c.title, base);
  remember(lang, { sec: sec.id, kind: "compare", id: c.id });
  const last = k === data.compare.length - 1;
  renderCompare({
    lang,
    sides: c.pair.map(id => ({ label: particleById(data, id).text, point: c.points[id], big: true })),
    examples: c.examples.map(ex => ({ ...ex, tag: particleById(data, ex.particle).text })),
    next: last ? { hash: base, label: "조사 목록으로" } : { hash: `${base}/vs/${k + 1}`, label: `다음 비교: ${data.compare[k + 1].title}` }
  });
  bindHideToggle(() => viewCompare(lang, sec, k));
}

// 비슷한 패턴 비교 (data/<언어>/pattern_compare.json)
const patternPrefix = pt => pt.replace("___", "").replace("?", "").trim();
async function viewPatternCompare(lang, sec, k) {
  const L = LANGS[lang];
  let data, cmp;
  try { data = await loadData(lang, sec.id); cmp = await loadData(lang, "pattern_compare"); } catch (e) { return errorView(e); }
  const c = cmp.compare[k];
  const base = `#/${lang}/${sec.id}`;
  if (!c) { location.hash = base; return; }
  setHeader(c.title, base);
  remember(lang, { sec: sec.id, kind: "compare", id: c.id });
  const last = k === cmp.compare.length - 1;
  renderCompare({
    lang,
    sides: c.pair.map((pt, i) => {
      const idx = data.findIndex(p => p.pattern === pt);
      return { label: pt, point: c.points[i], practice: idx >= 0 ? `${base}/${idx}/0` : null };
    }),
    examples: c.examples.map(ex => ({ ...ex, tag: patternPrefix(c.pair[ex.side]) })),
    next: last ? { hash: base, label: "패턴 목록으로" } : { hash: `${base}/vs/${k + 1}`, label: `다음 비교: ${cmp.compare[k + 1].title}` }
  });
  bindHideToggle(() => viewPatternCompare(lang, sec, k));
}
