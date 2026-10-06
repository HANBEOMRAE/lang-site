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

// ── 첫 화면: 언어 고르기 ─────────────────────────
function viewHome() {
  document.body.className = "";
  setHeader("첫말", null);
  app.innerHTML = `
    <p class="hello">오늘은 어떤 말을<br>배워 볼까요?</p>
    <p class="hello-sub">언어를 고르면 그 언어만 보여요.</p>
    <div class="lang-pick">
      ${Object.entries(LANGS).map(([id, L]) => `
        <button class="lang-btn ${id}" data-go="#/${id}">
          <span class="big">${L.big}</span>
          <span><span class="name">${L.name}</span><span class="desc">${L.desc}</span></span>
        </button>`).join("")}
    </div>`;
}

// ── 언어 홈: 섹션 4개 ────────────────────────────
function viewLang(lang) {
  const L = LANGS[lang];
  document.body.className = `lang-${lang}`;
  setHeader(L.name, "#/");
  app.innerHTML = `
    <p class="lead">위에서부터 차례로 공부해요.</p>
    <div class="list">
      ${L.sections.map((s, i) => `
        <button class="row" ${s.ready ? `data-go="#/${lang}/${s.id}"` : "disabled"}>
          <span class="step">${i + 1}</span>
          <span class="label"><strong>${s.name}</strong><small>${s.ready ? s.desc : "준비 중"}</small></span>
        </button>`).join("")}
    </div>`;
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

  app.innerHTML = `
    <div class="viewer">
      <div class="tools">${progressBar(i, n)}${hideToggle()}</div>
      <article class="card" id="card">
        <p class="word" lang="${lang}">${wordHTML(it.text)}</p>
        ${it.kanji ? `<p class="kanji-big" lang="${lang}">${esc(it.kanji)}</p>` : ""}
        <div class="${H()}">
          <p class="pron">${esc(it.ko_pron)}</p>
          <p class="meaning">${esc(it.meaning)}</p>
        </div>
        <button class="speak" id="speakWord" aria-label="${esc(it.text)} 발음 듣기">🔊</button>
        ${it.note ? `<p class="note">${noBreakJa(it.note)}</p>` : ""}
        ${it.example ? `
          <div class="example">
            <p><span class="en-line" lang="${lang}">${esc(it.example)}</span><br>
               ${it.example_ko_pron ? `<span class="pron-s ${H()}">${esc(it.example_ko_pron)}</span>` : ""}
               <span class="ko-line ${H()}">${esc(it.example_meaning)}</span></p>
            <button class="mini-speak" id="speakEx" aria-label="예문 듣기">🔊</button>
          </div>` : ""}
      </article>
      <div class="nav">
        <button id="prev" ${i === 0 ? "disabled" : ""}>이전</button>
        <button id="next" class="primary">${i === n - 1 ? "처음부터" : "다음"}</button>
      </div>
    </div>`;

  const go = j => { location.hash = `${base}/${(j + n) % n}`; };
  const next = () => go(i === n - 1 ? 0 : i + 1);
  const prev = () => { if (i > 0) go(i - 1); };
  document.getElementById("speakWord").onclick = e => tts.speak(it.text, L.voice, e.currentTarget);
  const ex = document.getElementById("speakEx");
  if (ex) ex.onclick = e => tts.speak(it.example, L.voice, e.currentTarget);
  document.getElementById("prev").onclick = prev;
  document.getElementById("next").onclick = next;
  addSwipe(document.getElementById("card"), next, prev);
  fitWord();
  bindHideToggle(() => viewCards(lang, sec, catIdx, i));
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
      </div>`).join("")}`;
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

  app.innerHTML = `
    <div class="viewer">
      <div class="tools">${progressBar(i, n)}${hideToggle()}</div>
      <p class="frame" lang="${lang}">${esc(before)}<span class="slot">?</span>${esc(after)}
        ${p.tip ? `<small>${esc(p.tip)}</small>` : ""}</p>
      <article class="card" id="card">
        <p class="sentence" lang="${lang}">${esc(before)}<span class="fill">${esc(f.text)}</span>${esc(after)}</p>
        <div class="${H()}">
          <p class="pron">${esc(pron)}</p>
          <p class="meaning">${esc(f.meaning)}</p>
        </div>
        <button class="speak" id="speak" aria-label="문장 듣기">🔊</button>
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
  bindHideToggle(() => viewPattern(lang, sec, pIdx, i));
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
    tts.speak(s.dialogues[b.dataset.d].lines[b.dataset.k].text, L.voice);
  }));
  app.querySelectorAll("[data-play]").forEach(b => b.addEventListener("click", () => {
    const di = Number(b.dataset.play);
    const bubbles = app.querySelectorAll(`.bubble[data-d="${di}"]`);
    tts.speakAll(s.dialogues[di].lines.map(l => l.text), L.voice,
      k => { clearActive(); bubbles[k].classList.add("active"); bubbles[k].scrollIntoView({ block: "nearest", behavior: "smooth" }); },
      clearActive);
  }));
  app.querySelectorAll("[data-ph]").forEach(b => b.addEventListener("click", () =>
    tts.speak(s.phrases[b.dataset.ph].text, L.voice)));
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

  app.innerHTML = `
    <div class="tools">${progressBar(vIdx, n)}${hideToggle()}</div>
    <article class="card" id="card">
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
  fitWord();
  bindHideToggle(() => viewVerb(lang, sec, vIdx));
}
