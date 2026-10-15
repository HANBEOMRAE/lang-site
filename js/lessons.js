/* lessons.js — 퀴즈 화면, 오늘의 복습, 수업(단원·레슨) */

// ── 날짜 (휴대폰 시각 기준 "YYYY-MM-DD") ─────────────
function dayStr(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(n, from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + n); return dayStr(d); }

// ── 오늘의 복습 ─────────────────────────────────────
// 기록: localStorage "review" = { key: { due: "YYYY-MM-DD", stage: 0|1|2, kind: "star"|"wrong" } }
//  key는 ☆와 같은 모양("en/words/음식/water", "en/situations/장면/문장" …) 또는 퀴즈 "quiz:en/function_words/i-me/1".
//  퀴즈에서 틀리거나 ☆하면 1일 뒤 → "기억나요"면 3일 뒤 → 7일 뒤 → 끝. "헷갈려요"면 다시 1일 뒤.
//  하루에 보여 주는 것은 REVIEW_DAILY개까지. 이 기능 전에 해 둔 ☆는 처음 한 번 하루 REVIEW_SEED_PER_DAY개씩 며칠에 나눠 넣는다.
const REVIEW_STEPS = [1, 3, 7];
const REVIEW_DAILY = 20, REVIEW_SEED_PER_DAY = 10;
function reviewAll() {
  const v = store.get("review", {});
  const all = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  if (!store.get("reviewSeeded", false)) {               // 기존 ☆를 며칠에 나눠 넣기
    starList().forEach((k, i) => { if (!all[k]) all[k] = { due: addDays(1 + Math.floor(i / REVIEW_SEED_PER_DAY)), stage: 0, kind: "star" }; });
    store.set("review", all);
    store.set("reviewSeeded", true);
  }
  return all;
}
function reviewAdd(key, kind) {
  const all = reviewAll();
  all[key] = { due: addDays(REVIEW_STEPS[0]), stage: 0, kind: all[key]?.kind === "wrong" ? "wrong" : kind };
  store.set("review", all);
}
function reviewRemove(key) {
  const all = reviewAll();
  if (all[key] && all[key].kind === "star") { delete all[key]; store.set("review", all); }
}
// ☆를 켜면 복습에 넣고, 끄면 뺀다 (틀려서 들어간 것은 그대로) — views.js bindStar가 부른다
function reviewOnStar(key, on) { on ? reviewAdd(key, "star") : reviewRemove(key); }
function reviewDue(lang) {
  const today = dayStr();
  return Object.entries(reviewAll())
    .filter(([k, r]) => (k.startsWith(`${lang}/`) || k.startsWith(`quiz:${lang}/`)) && r.due <= today)
    .sort((a, b) => a[1].due.localeCompare(b[1].due))
    .slice(0, REVIEW_DAILY).map(([k]) => k);
}
function reviewAnswer(key, remembered) {
  const all = reviewAll(), r = all[key];
  if (!r) return;
  if (!remembered) { all[key] = { ...r, stage: 0, due: addDays(REVIEW_STEPS[0]) }; }
  else if (r.stage + 1 >= REVIEW_STEPS.length) { delete all[key]; }
  else { all[key] = { ...r, stage: r.stage + 1, due: addDays(REVIEW_STEPS[r.stage + 1]) }; }
  store.set("review", all);
}

// ── 퀴즈 ─────────────────────────────────────────
// 문제 하나: { type: "blank", q: 공통 퀴즈 형식, key }      빈칸 고르기 (일본어 조사·패턴 비교·작은 말·레슨)
//            { type: "listen" | "meaning", item, choices: [item…], key }   단어 듣고 뜻 고르기 / 뜻 보고 고르기 (레슨 새 단어로 자동)
// 틀리면 key를 오늘의 복습에 넣는다(단어 문제는 그 단어 카드 key).
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// "いぬ[___] いるよ！" → 빈칸 표시 (다른 [강조]는 markParticle이 처리)
const blankHTML = s => markParticle(String(s).replace("[___]", "\u0001")).replace("\u0001", '<span class="blank">?</span>');

// 공통 퀴즈 형식을 문제로: 파일 이름과 비교 id로 key를 만든다
function compareQuizQuestions(lang, file, c) {
  return (c.quiz || []).map((q, i) => ({ type: "blank", q, key: `quiz:${lang}/${file}/${c.id}/${i}` }));
}
// 퀴즈 key → 문제 (오늘의 복습이 다시 낼 때)
async function questionOfKey(key) {
  const [, rest] = key.split(":");
  const [lang, file, id, idx] = rest.split("/");
  try {
    if (file === "lessons") {
      const les = (await loadData(lang, "lessons")).units.flatMap(u => u.lessons).find(l => l.id === id);
      const q = les?.quiz?.[Number(idx)];
      return q && !q.ref ? { type: "blank", q, key } : null;
    }
    const d = await loadData(lang, file);
    const c = d.compare.find(x => x.id === id);
    const q = c?.quiz?.[Number(idx)];
    return q ? { type: "blank", q, key } : null;
  } catch { return null; }
}

// box 안에 문제를 하나씩 낸다. 다 풀면 onDone(맞은 수, 문제 수)
function runQuiz(lang, box, qs, onDone) {
  const voice = LANGS[lang].voice;
  let i = 0, right = 0;
  const show = () => {
    if (i >= qs.length) { onDone && onDone(right, qs.length); return; }
    const x = qs[i];
    const head = `<p class="quiz-count">문제 ${i + 1} / ${qs.length}</p>`;
    let body, opts, correct;
    if (x.type === "blank") {
      opts = shuffle(x.q.choices);
      correct = c => (x.q.answers || []).includes(c);
      body = `${x.q.context ? `<p class="quiz-context">${esc(x.q.context)}</p>` : ""}
        <p class="quiz-q" lang="${lang}">${blankHTML(x.q.text)}</p>`;
    } else {
      opts = shuffle(x.choices);
      correct = c => c === x.item;
      body = x.type === "listen"
        ? `<p class="quiz-ask">듣고 뜻을 골라요</p><button class="speak quiz-speak" id="quizSay" aria-label="다시 듣기">🔊</button>`
        : `<p class="quiz-ask">이 뜻의 말을 골라요</p><p class="quiz-q">${esc(x.item.meaning)}</p>`;
    }
    const label = c => x.type === "blank" ? `<span lang="${lang}">${esc(c)}</span>`
      : x.type === "listen" ? esc(c.meaning) : `<span lang="${lang}">${esc(c.text)}</span>`;
    box.innerHTML = `${head}<div class="quiz-body">${body}</div>
      <div class="quiz-opts">${opts.map((c, k) => `<button class="quiz-opt" data-k="${k}">${label(c)}</button>`).join("")}</div>
      <div class="quiz-after" id="quizAfter" hidden></div>`;
    const say = document.getElementById("quizSay");
    if (say) { say.onclick = e => tts.speak(x.item.text, voice, e.currentTarget); setTimeout(() => tts.speak(x.item.text, voice), 250); }
    box.querySelectorAll(".quiz-opt").forEach(b => b.onclick = () => {
      if (box.querySelector(".quiz-opt.right, .quiz-opt.wrong")) return;      // 한 번만
      const pick = opts[b.dataset.k], ok = correct(pick);
      box.querySelectorAll(".quiz-opt").forEach(o => { if (correct(opts[o.dataset.k])) o.classList.add("right"); });
      if (!ok) { b.classList.add("wrong"); if (x.key) reviewAdd(x.key, "wrong"); } else right++;
      const after = document.getElementById("quizAfter");
      const ans = x.type === "blank" ? x.q.text.replace("[___]", (x.q.answers || [])[0]) : x.item.text;
      const info = x.type === "blank" ? x.q : x.item;
      after.innerHTML = `
        <p class="quiz-result ${ok ? "ok" : "no"}">${ok ? "맞았어요!" : "아쉬워요. 오늘의 복습에 다시 나와요."}</p>
        <div class="quiz-answer">
          <p><strong lang="${lang}">${markParticle(ans)}</strong>
            ${x.type === "blank" && x.q.kanji_text ? `<span class="kanji" lang="${lang}">${esc(x.q.kanji_text.replace("[___]", (x.q.answers || [])[0]))}</span>` : ""}
            <span class="pron-s">${esc(info.ko_pron)}</span><span class="mean-s">${esc(info.meaning)}</span>
            ${x.type === "blank" && x.q.why ? `<span class="why">${esc(x.q.why)}</span>` : ""}</p>
          <button class="mini-speak" id="quizAns" aria-label="정답 듣기">🔊</button>
        </div>
        <button class="primary quiz-next" id="quizNext">${i === qs.length - 1 ? "결과 보기" : "다음 문제"}</button>`;
      after.hidden = false;
      document.getElementById("quizAns").onclick = e => tts.speak(plainText(ans), voice, e.currentTarget);
      document.getElementById("quizNext").onclick = () => { i++; show(); };
    });
  };
  show();
}

// 비교 화면의 퀴즈 (#/ja/particles/vs/0/quiz, #/en/patterns/vs/1/quiz …)
async function viewCompareQuiz(lang, sec, k) {
  const file = sec.type === "patterns" ? "pattern_compare" : sec.id;
  let c;
  try { c = (await loadData(lang, file)).compare[k]; } catch (e) { return errorView(e); }
  const back = `#/${lang}/${sec.id}/vs/${k}`;
  if (!c || !(c.quiz || []).length) { location.hash = back; return; }
  setHeader(`${c.title} 퀴즈`, back);
  app.innerHTML = `<div class="quiz" id="quizBox"></div>`;
  runQuiz(lang, document.getElementById("quizBox"), shuffle(compareQuizQuestions(lang, file, c)), (r, n) => {
    document.getElementById("quizBox").innerHTML = `
      <p class="quiz-done">${n}문제 중 ${r}문제 맞았어요!</p>
      ${r < n ? `<p class="lead">틀린 문제는 오늘의 복습에 다시 나와요.</p>` : ""}
      <div class="nav"><button data-go="${back}">비교로 돌아가기</button><button class="primary" id="again">다시 풀기</button></div>`;
    document.getElementById("again").onclick = () => viewCompareQuiz(lang, sec, k);
  });
}

// 오늘의 복습 (#/en/review): 하나씩 보고 "기억나요 / 헷갈려요"
async function viewReview(lang) {
  setHeader("오늘의 복습", `#/${lang}`);
  app.innerHTML = `<p class="lead">불러오는 중…</p>`;
  const keys = reviewDue(lang);
  for (const key of keys) {
    const drop = () => { const all = reviewAll(); delete all[key]; store.set("review", all); };   // 사라진 항목은 뺀다
    const left = keys.length - keys.indexOf(key);
    if (key.startsWith("quiz:")) {
      const x = await questionOfKey(key);
      if (!x) { drop(); continue; }
      app.innerHTML = `<p class="lead">남은 복습 ${left}개 · 다시 풀어 봐요</p><div class="quiz" id="quizBox"></div>`;
      // 틀리면 runQuiz가 1일 뒤로 되돌리고, 맞으면 다음 간격으로
      runQuiz(lang, document.getElementById("quizBox"), [x], r => { if (r) reviewAnswer(key, true); viewReview(lang); });
      return;
    }
    const r = await resolveStar(lang, key);
    if (!r) { drop(); continue; }
    app.innerHTML = `
      <div class="viewer">
        <p class="lead">남은 복습 ${left}개 · 뜻을 떠올려 보고 눌러 봐요</p>
        <p class="star-src">${esc(r.src)}</p>
        ${r.kind === "word" ? cardHTML(lang, r.it, null) : sentenceCardHTML(lang, r.x, null)}
        <div class="nav review-nav">
          <button id="again">헷갈려요</button>
          <button class="primary" id="ok">기억나요</button>
          <button id="prev" hidden></button><button id="next" hidden></button>
        </div>
      </div>`;
    // 처음에는 뜻을 가려 두고 눌러서 본다
    app.querySelectorAll("#card .pron, #card .meaning, #card .ko-line, #card .pron-s").forEach(el => el.classList.add("hideable"));
    bindHideToggle(() => {});
    const noop = () => {};
    if (r.kind === "word") bindCard(lang, r.it, null, noop, noop);
    else await bindSentenceCard(lang, r.x, null, noop, noop);
    document.getElementById("ok").onclick = () => { reviewAnswer(key, true); viewReview(lang); };
    document.getElementById("again").onclick = () => { reviewAnswer(key, false); viewReview(lang); };
    return;
  }
  app.innerHTML = `<p class="hello">오늘 복습 끝! 🎉</p>
    <p class="lead">퀴즈에서 틀리거나 ☆한 것은 1일·3일·7일 뒤에 다시 나와요.</p>
    <div class="nav"><button class="primary" data-go="#/${lang}">홈으로</button></div>`;
}

// ── 📘 수업 (data/<언어>/lessons.json) ─────────────────
// 단원 → 레슨. 레슨은 재료를 이름으로 가리킨다(복사하지 않는다). validate.py check_lessons와 같은 모양:
//  w:주제/단어  v:주제/동사(일본어 v:-/동사)  fw:작은말id  pt:조사  p:틀(+fills)  ph:장면/문장  d:장면/대화 제목(+lines)  ld:레슨 대화 id
//  tip:알아두기 id  q:파일/비교id/번호(퀴즈)
// 레슨 흐름: 목표 → 대화 듣기(뜻 가림) → 새 단어 → 핵심 패턴·조사 → 따라 말하기 → 확인 문제 → 대화 다시 듣기
// 진도: localStorage "lessonDone" = { 언어: [레슨 id…] } (이름 기준). 잠그지 않는다.
const LESSON_STEPS = [["goal", "목표"], ["listen", "듣기"], ["words", "단어"], ["core", "패턴"], ["say", "말하기"], ["quiz", "문제"], ["again", "다시"]];
const REVIEW_LESSON_STEPS = [["goal", "목표"], ["listen", "듣기"], ["words", "단어"], ["quiz", "문제"], ["again", "다시"]];
const lessonCtxCache = {};
function loadLessonCtx(lang) {
  return lessonCtxCache[lang] ||= (async () => {
    const L = LANGS[lang];
    const get = async id => { const s = L.sections.find(x => x.id === id && x.ready); if (!s) return null;
      try { return { s, d: await loadData(lang, s.id) }; } catch { return null; } };
    const data = await loadData(lang, "lessons");
    const ctx = { lang, data, words: await get("words"), verbs: await get("verbs"), fw: await get("function_words"),
      pt: await get("particles"), pat: await get("patterns"), sit: await get("situations"), tips: await loadTips(lang),
      own: Object.fromEntries((data.dialogues || []).map(d => [d.id, d])) };
    ctx.lessons = data.units.flatMap((u, ui) => u.lessons.map((les, li) => ({ ...les, ui, li, unit: u })));
    return ctx;
  })().catch(e => { delete lessonCtxCache[lang]; throw e; });
}
const lessonDone = lang => { const v = store.get("lessonDone", {}); return Array.isArray(v?.[lang]) ? v[lang] : []; };
function markLessonDone(lang, id) {
  const v = store.get("lessonDone", {}); const all = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  all[lang] = [...new Set([...(Array.isArray(all[lang]) ? all[lang] : []), id])];
  store.set("lessonDone", all);
}
const nextLesson = (ctx, lang) => ctx.lessons.find(l => !lessonDone(lang).includes(l.id)) || null;
const lessonHash = (lang, l, step = 0) => `#/${lang}/lessons/${l.ui}/${l.li}${step ? `/${step}` : ""}`;
const lessonNo = l => l.review ? `${l.ui + 1}-복습` : `${l.ui + 1}-${l.li + 1}`;

// 이어서 하기 (views.js resolvePlace가 부른다): { kind: "lesson", id, step }
async function lessonPlace(lang, ref) {
  try {
    const ctx = await loadLessonCtx(lang);
    const l = ctx.lessons.find(x => x.id === ref.id);
    return l ? { hash: lessonHash(lang, l, ref.step || 0), label: `${LANGS[lang].name} · 수업 ${lessonNo(l)} ${l.title}` } : null;
  } catch { return null; }
}

// 재료 찾기 ──
function lessonWord(ctx, ref) {
  const { lang } = ctx;
  const [kind, rest] = [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)];
  if (kind === "w" || kind === "v") {
    const [cat, ...t] = rest.split("/"); const text = t.join("/");
    const x = kind === "w" ? ctx.words : ctx.verbs;
    if (!x) return null;
    if (Array.isArray(x.d)) {
      const c = x.d.find(c => c.category === cat), it = c && c.items.find(i => i.text === text);
      return it ? { it, star: starKey(lang, x.s.id, cat, it.text), src: `${x.s.name} · ${cat}` } : null;
    }
    const v = x.d.verbs.find(v => v.text === text);
    return v ? { it: verbCardItem(v), star: starKey(lang, x.s.id, "-", v.text), src: x.s.name } : null;
  }
  if (kind === "fw" && ctx.fw) {
    const it = ctx.fw.d.items.find(i => i.id === rest), ex = it?.uses[0]?.examples[0];
    return it ? { it: { text: it.text, ko_pron: it.ko_pron, meaning: it.meaning, example: ex && plainText(ex.text), example_meaning: ex?.meaning },
                  star: null, src: ctx.fw.s.name, fw: it, hash: `#/${lang}/${ctx.fw.s.id}/${ctx.fw.d.items.indexOf(it)}` } : null;
  }
  if (kind === "pt" && ctx.pt) {
    const p = ctx.pt.d.particles.find(i => i.text === rest);
    return p ? { it: { text: p.text, ko_pron: p.ko_pron, meaning: p.meaning, note: p.role }, star: null, src: ctx.pt.s.name, pt: p,
                 hash: `#/${lang}/${ctx.pt.s.id}/${ctx.pt.d.particles.indexOf(p)}` } : null;
  }
  return null;
}
// 대화: [{ title, lines, scene(뜻 찾기용 words 칸), starOf(line), gwCat }]
function lessonDialogues(ctx, les) {
  const { lang } = ctx;
  return (les.dialogues || []).map(item => {
    const [kind, rest] = [item.ref.slice(0, item.ref.indexOf(":")), item.ref.slice(item.ref.indexOf(":") + 1)];
    let d, scene, starOf, gwCat;
    if (kind === "ld") {
      d = ctx.own[rest]; scene = d; gwCat = `ld:${rest}`;
      starOf = l => starKey(lang, "lessons", rest, l.text);
    } else if (kind === "d" && ctx.sit) {
      const [sc, ...t] = rest.split("/");
      scene = ctx.sit.d.find(s => s.scene === sc); d = scene?.dialogues.find(x => x.title === t.join("/")); gwCat = sc;
      starOf = l => starKey(lang, ctx.sit.s.id, sc, l.text);
    }
    if (!d) return null;
    const lines = item.lines ? item.lines.map(i => d.lines[i]).filter(Boolean) : d.lines;
    return { title: d.title, lines, scene, starOf, gwCat };
  }).filter(Boolean);
}
// 핵심 재료 → 화면 블록 정보
function lessonCore(ctx, les) {
  const { lang } = ctx;
  return (les.core || []).map(item => {
    const [kind, rest] = [item.ref.slice(0, item.ref.indexOf(":")), item.ref.slice(item.ref.indexOf(":") + 1)];
    if (kind === "p" && ctx.pat) {
      const p = ctx.pat.d.find(x => x.pattern === rest);
      if (!p) return null;
      const fills = (item.fills || p.fills.map(f => f.text)).map(t => p.fills.find(f => f.text === t)).filter(Boolean);
      return { kind, p, fills, hash: `#/${lang}/${ctx.pat.s.id}/${ctx.pat.d.indexOf(p)}/0`,
               rows: fills.map(f => ({ text: p.pattern.replace("___", f.text), ko_pron: p.ko_pron.replace("___", f.ko_pron), meaning: f.meaning, kanji_text: f.kanji_text,
                                       star: starKey(lang, ctx.pat.s.id, p.pattern, f.text), f })) };
    }
    if (kind === "ph" && ctx.sit) {
      const [sc, ...t] = rest.split("/");
      const scene = ctx.sit.d.find(s => s.scene === sc), ph = scene?.phrases.find(x => x.text === t.join("/"));
      return ph ? { kind, scene, rows: [{ ...ph, line: ph, star: starKey(lang, ctx.sit.s.id, sc, ph.text) }] } : null;
    }
    if (kind === "tip") { const t = ctx.tips.find(x => x.id === rest); return t ? { kind, tip: t } : null; }
    if (kind === "fw" || kind === "pt") { const w = lessonWord(ctx, item.ref); return w ? { kind, w } : null; }
    return null;
  }).filter(Boolean);
}
const unitWords = (ctx, l) => ctx.lessons.filter(x => x.ui === l.ui && !x.review).flatMap(x => x.words || []);

// 단원 목록 (#/en/lessons)
async function viewLessons(lang) {
  setHeader("📘 수업", `#/${lang}`);
  app.innerHTML = `<p class="lead">불러오는 중…</p>`;
  let ctx;
  try { ctx = await loadLessonCtx(lang); } catch (e) { return errorView(e); }
  const done = lessonDone(lang), next = nextLesson(ctx, lang);
  app.innerHTML = `
    <p class="lead">단원마다 "할 수 있는 말"을 목표로 배워요. 순서대로 하면 좋지만, 어느 레슨이든 열 수 있어요.</p>
    ${ctx.data.units.map((u, ui) => {
      const ls = ctx.lessons.filter(l => l.ui === ui), n = ls.filter(l => done.includes(l.id)).length;
      return `
      <h2 class="group">${ui + 1}. ${esc(u.title)} <small class="group-desc">${n}/${ls.length}</small></h2>
      <p class="unit-goal">🎯 ${esc(u.goal)}</p>
      <div class="list">
        ${ls.map(l => `
          <button class="row lesson-row ${done.includes(l.id) ? "done" : ""} ${next && next.id === l.id ? "next" : ""}" data-go="${lessonHash(lang, l)}">
            <span class="step">${done.includes(l.id) ? "✓" : l.review ? "🔁" : l.li + 1}</span>
            <span class="label"><strong>${esc(lessonNo(l))} ${esc(l.title)}</strong><small>${esc(l.goal)}</small></span>
          </button>`).join("")}
      </div>`; }).join("")}`;
}

// 언어 홈의 📘 수업 상자 채우기 (views.js viewLang이 부른다)
async function fillLessonBox(lang) {
  const box = document.getElementById("lessonRows");
  if (!box) return;
  let ctx;
  try { ctx = await loadLessonCtx(lang); } catch { box.innerHTML = ""; return; }
  if (!box.isConnected) return;
  const next = nextLesson(ctx, lang), due = reviewDue(lang).length;
  box.innerHTML = `
    ${next ? `<button class="row lesson-next" data-go="${lessonHash(lang, next)}">
        <span class="em" aria-hidden="true">▶</span>
        <span class="label"><strong>다음 레슨: ${esc(lessonNo(next))} ${esc(next.title)}</strong><small>${esc(next.goal)}</small></span>
      </button>` : `<p class="lead">모든 레슨을 끝냈어요! 🎉</p>`}
    <button class="row review-row" data-go="#/${lang}/review">
      <span class="em" aria-hidden="true">🔁</span>
      <span class="label"><strong>오늘의 복습</strong><small>${due ? `오늘 볼 것 ${due}개` : "오늘은 복습할 게 없어요"}</small></span>
    </button>
    <button class="row" data-go="#/${lang}/lessons">
      <span class="em" aria-hidden="true">📘</span>
      <span class="label"><strong>단원 전체 보기</strong><small>${ctx.data.units.length}단원 · 끝낸 레슨 ${lessonDone(lang).length}/${ctx.lessons.length}</small></span>
    </button>`;
}

// 레슨 (#/en/lessons/0/1/3 → 단원 1, 레슨 2, 4번째 단계)
async function viewLesson(lang, ui, li, si) {
  let ctx;
  try { ctx = await loadLessonCtx(lang); } catch (e) { return errorView(e); }
  const les = ctx.lessons.find(l => l.ui === ui && l.li === li);
  if (!les) { location.hash = `#/${lang}/lessons`; return; }
  const steps = les.review ? REVIEW_LESSON_STEPS : LESSON_STEPS;
  const s = Math.min(Math.max(si || 0, 0), steps.length - 1), step = steps[s][0];
  setHeader(`${lessonNo(les)} ${les.title}`, `#/${lang}/lessons`);
  remember(lang, { sec: "lessons", kind: "lesson", id: les.id, step: s });
  const go = k => { location.hash = lessonHash(lang, les, k); };
  const dlgs = lessonDialogues(ctx, les);
  const words = (les.review ? unitWords(ctx, les) : les.words || []).map(r => lessonWord(ctx, r)).filter(Boolean);
  const core = lessonCore(ctx, les);
  const bar = `<ol class="lesson-steps">${steps.map(([, name], k) =>
    `<li class="${k === s ? "on" : k < s ? "past" : ""}"><button data-go="${lessonHash(lang, les, k)}">${k + 1}<span>${name}</span></button></li>`).join("")}</ol>`;
  const last = s === steps.length - 1;
  const nav = `<div class="nav">
      <button id="prevStep" ${s === 0 ? "disabled" : ""}>이전</button>
      <button class="primary" id="nextStep">${last ? "레슨 끝 ✓" : s === 0 ? "시작" : "다음"}</button></div>`;
  let body = "";
  if (step === "goal") {
    body = `<div class="lesson-goal">
        <p class="unit-goal">단원 ${ui + 1} · ${esc(les.unit.title)}</p>
        <p class="goal-big">🎯 ${esc(les.goal)}</p>
        ${words.length ? `<p class="lead">새 단어</p><div class="chips">${words.map(w => `<span class="chip" lang="${lang}">${esc(w.it.text)}</span>`).join("")}</div>` : ""}
        ${core.filter(c => !((c.kind === "fw" || c.kind === "pt") && words.some(w => w.it.text === c.w.it.text))).length ? `<p class="lead">핵심</p><div class="chips">${core.filter(c => !((c.kind === "fw" || c.kind === "pt") && words.some(w => w.it.text === c.w.it.text))).map(c => `<span class="chip" lang="${lang}">${esc(
          c.kind === "p" ? c.p.pattern : c.kind === "ph" ? c.rows[0].text : c.kind === "tip" ? c.tip.title : c.w.it.text)}</span>`).join("")}</div>` : ""}
        <p class="lead">10~15분 · ${steps.map(x => x[1]).join(" → ")}</p></div>`;
  } else if (step === "listen" || step === "again") {
    body = `<p class="lead">${step === "listen" ? "먼저 대화를 들어 봐요. 뜻은 가려 두었어요(누르면 보여요)." : "이제 단어를 눌러 뜻도 보고, 다시 들어 봐요."}</p>
      ${lessonDialogueHTML(lang, dlgs, step === "listen")}`;
  } else if (step === "words") {
    body = `<p class="lead">${les.review ? "이 단원에서 배운 단어예요." : "새 단어예요. 눌러서 듣고 따라 말해 봐요."}</p>
      <div class="list phrase-list lesson-words">${words.map((w, k) => `
        <button class="row phrase" data-wi="${k}">
          <span class="label"><strong lang="${lang}">${esc(w.it.text)}</strong>${w.it.kanji ? ` <small class="kanji" lang="${lang}">${esc(w.it.kanji)}</small>` : ""}
            <small class="${H()}">${esc(w.it.ko_pron)} · ${esc(w.it.meaning)}</small></span>
          <span class="mini-speak" aria-hidden="true">🔊</span>
        </button>`).join("")}</div>`;
  } else if (step === "core") {
    body = core.map((c, ci) => lessonCoreHTML(lang, c, ci)).join("") || `<p class="lead">이 레슨은 대화에 집중해요.</p>`;
  } else if (step === "say") {
    body = `<p class="lead">눌러서 듣고, 🎤로 따라 말해 봐요. ⏺로 녹음해서 비교할 수도 있어요.</p>
      <div class="list phrase-list">${sayRows(dlgs, core).map((r, k) => `
        <button class="row phrase say-row" data-si="${k}">
          <span class="label"><strong lang="${lang}">${esc(r.text)}</strong><small class="${H()}">${esc(r.ko_pron)} · ${esc(r.meaning)}</small></span>
          <span class="mini-speak" aria-hidden="true">🔊</span>
        </button>`).join("")}</div>`;
  } else if (step === "quiz") {
    body = `<div class="quiz" id="quizBox"></div>`;
  }
  app.innerHTML = `<div class="lesson">${bar}${step === "goal" || step === "quiz" ? "" : `<div class="tools">${hideToggle()}</div>`}${body}${nav}
    <div id="lessonEnd"></div></div>`;

  document.getElementById("prevStep").onclick = () => { if (s > 0) go(s - 1); };
  document.getElementById("nextStep").onclick = () => {
    if (!last) return go(s + 1);
    markLessonDone(lang, les.id);
    const nx = nextLesson(ctx, lang);
    document.getElementById("lessonEnd").innerHTML = `
      <div class="lesson-done"><p class="hello">레슨 끝! 🎉</p>
        <p class="lead">${esc(les.goal)}</p>
        <div class="list">
          ${nx ? `<button class="row lesson-next" data-go="${lessonHash(lang, nx)}"><span class="em">▶</span>
            <span class="label"><strong>다음 레슨: ${esc(lessonNo(nx))} ${esc(nx.title)}</strong><small>${esc(nx.goal)}</small></span></button>` : ""}
          <button class="row" data-go="#/${lang}/lessons"><span class="em">📘</span><span class="label"><strong>단원 목록</strong></span></button>
        </div></div>`;
    document.getElementById("lessonEnd").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (step === "listen" || step === "again") await bindLessonDialogues(lang, dlgs, step === "again");
  if (step === "words") app.querySelectorAll("[data-wi]").forEach(b => b.addEventListener("click", () => {
    const w = words[b.dataset.wi];
    tts.speak(w.it.text, LANGS[lang].voice);
    attachInlineTools(b, lang, [w.it.text, w.it.kanji], false, w.star);
  }));
  if (step === "core") await bindLessonCore(lang, core);
  if (step === "say") { const rows = sayRows(dlgs, core);
    app.querySelectorAll("[data-si]").forEach(b => b.addEventListener("click", () => {
      const r = rows[b.dataset.si];
      tts.speak(plainText(r.text), LANGS[lang].voice);
      attachInlineTools(b, lang, [r.text, r.kanji_text], false, r.star);
    })); }
  if (step === "quiz") runQuiz(lang, document.getElementById("quizBox"), await lessonQuiz(ctx, les, words), (r, n) => {
    document.getElementById("quizBox").innerHTML = `<p class="quiz-done">${n}문제 중 ${r}문제 맞았어요!</p>
      ${r < n ? `<p class="lead">틀린 것은 오늘의 복습에 다시 나와요.</p>` : ""}`;
  });
  bindHideToggle(() => viewLesson(lang, ui, li, s));
}

function lessonDialogueHTML(lang, dlgs, hideMeaning) {
  return dlgs.map((d, di) => `
    <section class="dialogue" data-di="${di}">
      <div class="d-head"><h2 class="group">${esc(d.title)}</h2><button class="chip play" data-play="${di}">▶ 전체 듣기</button></div>
      <div class="talk">${d.lines.map((l, k) => `
        <button class="bubble ${l.who === "나" ? "me" : ""}" data-d="${di}" data-k="${k}">
          <span class="who">${esc(l.who)}</span>
          <span class="say" lang="${lang}">${lineHTML(lang, l)}</span>
          <span class="${hideMeaning ? "hideable" : H()}"><span class="pron-s">${esc(l.ko_pron)}</span><span class="mean-s">${esc(l.meaning)}</span></span>
        </button>`).join("")}</div>
    </section>`).join("");
}
async function bindLessonDialogues(lang, dlgs, gloss) {
  const voice = LANGS[lang].voice;
  const clearActive = () => app.querySelectorAll(".bubble.active").forEach(b => b.classList.remove("active"));
  app.querySelectorAll(".bubble").forEach(b => b.addEventListener("click", () => {
    clearActive(); b.classList.add("active");
    const d = dlgs[b.dataset.d], ln = d.lines[b.dataset.k];
    tts.speak(ln.text, voice);
    attachInlineTools(b, lang, [ln.text, ln.kanji_text], b.classList.contains("me"), d.starOf(ln));
  }));
  app.querySelectorAll("[data-play]").forEach(b => b.addEventListener("click", () => {
    const di = Number(b.dataset.play), bubbles = app.querySelectorAll(`.bubble[data-d="${di}"]`);
    tts.speakAll(dlgs[di].lines.map(l => l.text), voice,
      k => { clearActive(); bubbles[k].classList.add("active"); bubbles[k].scrollIntoView({ block: "nearest", behavior: "smooth" }); }, clearActive);
  }));
  if (!gloss) return;
  let gi; try { gi = await loadGlossIndex(lang); } catch { return; }
  const fwIdx = await loadFwIndex(lang);
  app.querySelectorAll(".dialogue").forEach(box => {
    const d = dlgs[box.dataset.di];
    const lookup = el => { const b = el.closest(".bubble"); return b ? glossLookup(gi, d.scene || {}, d.lines[b.dataset.k], el.dataset.k, el.dataset.n, el.dataset.mid === "1") : null; };
    bindWordGloss(lang, box, lookup, fwIdx, { starOf: (el, g) => g.star || starKey(lang, "gw", d.gwCat, el.dataset.k) });
    if (lang === "ja") box.querySelectorAll(".say .w").forEach(el => { if (lookup(el)?.form === "조사") el.classList.add("pt"); });
  });
}

function lessonCoreHTML(lang, c, ci) {
  if (c.kind === "p") {
    const [before, after] = c.p.pattern.split("___");
    return `<section class="core-block" data-ci="${ci}">
      <p class="frame" lang="${lang}">${esc(before)}<span class="slot">?</span>${esc(after)}${c.p.tip ? `<small>${esc(c.p.tip)}</small>` : ""}</p>
      <div class="list phrase-list">${c.rows.map((r, k) => `
        <button class="row phrase" data-ci="${ci}" data-ri="${k}">
          <span class="label"><strong lang="${lang}">${patternSentenceHTML(lang, c.p, r.f)}</strong><small class="${H()}">${esc(r.ko_pron)} · ${esc(r.meaning)}</small></span>
          <span class="mini-speak" aria-hidden="true">🔊</span>
        </button>`).join("")}</div>
      <div class="chips related"><button class="chip" data-go="${c.hash}">패턴 영어에서 더 연습하기 →</button></div>
    </section>`;
  }
  if (c.kind === "ph") return `<section class="core-block" data-ci="${ci}"><h2 class="group">핵심 문장</h2>
      <div class="list phrase-list">${c.rows.map((r, k) => `
        <button class="row phrase" data-ci="${ci}" data-ri="${k}">
          <span class="label"><strong lang="${lang}">${lineHTML(lang, r.line)}</strong><small class="${H()}">${esc(r.ko_pron)} · ${esc(r.meaning)}</small></span>
          <span class="mini-speak" aria-hidden="true">🔊</span>
        </button>`).join("")}</div></section>`;
  if (c.kind === "tip") return `<section class="core-block tip-panel" data-ci="${ci}">${tipHTML(lang, c.tip, ci, true)}</section>`;
  const it = c.w.fw || c.w.pt;
  return `<section class="core-block" data-ci="${ci}">
      <div class="note explain core-word"><p class="core-word-big" lang="${lang}">${esc(it.text)}</p>
        <p><strong>${esc(it.meaning)}</strong> · ${esc(it.ko_pron)}</p>
        ${it.explain ? chunksHTML(it.explain) : it.role ? `<span class="ex-line">${esc(it.role)}</span>` : ""}
        ${it.note ? `<span class="ex-line">💡 ${noBreakJa(it.note)}</span>` : ""}
        <button class="chip" data-go="${c.w.hash}">${esc(c.w.src)}에서 자세히 →</button></div>
    </section>`;
}
async function bindLessonCore(lang, core) {
  const voice = LANGS[lang].voice;
  let gi = null; try { gi = await loadGlossIndex(lang); } catch {}
  const fwIdx = await loadFwIndex(lang);
  const tips = core.filter(c => c.kind === "tip").map(c => c.tip);
  core.forEach((c, ci) => {
    const box = app.querySelector(`.core-block[data-ci="${ci}"]`);
    if (!box) return;
    box.querySelectorAll("[data-ri]").forEach(b => b.addEventListener("click", () => {
      const r = c.rows[b.dataset.ri];
      tts.speak(plainText(r.text), voice);
      attachInlineTools(b, lang, [r.text, r.kanji_text], false, r.star);
    }));
    if (c.kind === "p") bindPatternGloss(lang, box.querySelector(".phrase-list"), c.p, el => c.rows[el.closest("[data-ri]").dataset.ri].f);
    if (c.kind === "ph" && gi) bindWordGloss(lang, box.querySelector(".phrase-list"),
      el => glossLookup(gi, c.scene, c.rows[0].line, el.dataset.k, el.dataset.n, el.dataset.mid === "1"), fwIdx,
      { starOf: (el, g) => g.star || starKey(lang, "gw", c.scene.scene, el.dataset.k) });
  });
  // 💡 설명: tipHTML은 data-t로 tips 목록 번호를 쓰므로 블록 번호(ci) 자리에 그 설명을 둔다
  if (tips.length) bindTips(lang, Object.fromEntries(core.map((c, ci) => [ci, c.tip]).filter(([, t]) => t)), fwIdx);
}
// 따라 말하기: 대화의 "나" 줄(없으면 모든 줄) + 핵심 문장
function sayRows(dlgs, core) {
  const mine = dlgs.flatMap(d => { const me = d.lines.filter(l => l.who === "나"); return (me.length ? me : d.lines).map(l => ({ ...l, star: d.starOf(l) })); });
  return [...mine, ...core.flatMap(c => c.rows || [])];
}
// 확인 문제: 새 단어로 자동(듣고 뜻 고르기·뜻 보고 고르기) + 레슨 문제(빈칸 고르기). 3~5개
async function lessonQuiz(ctx, les, words) {
  const { lang } = ctx;
  const own = (les.quiz || []).map((q, i) => {
    if (!q.ref) return { type: "blank", q, key: `quiz:${lang}/lessons/${les.id}/${i}` };
    const m = q.ref.match(/^q:([^/]+)\/([^/]+)\/(\d+)$/);
    return m ? { ref: { file: m[1], id: m[2], idx: Number(m[3]) } } : null;
  }).filter(Boolean);
  const pool = words.filter(w => w.it.meaning);
  const auto = [];
  const nAuto = Math.max(1, Math.min(3, 5 - own.length));
  shuffle(pool).slice(0, nAuto).forEach((w, k) => {
    const others = shuffle(pool.filter(x => x !== w && x.it.meaning !== w.it.meaning)).slice(0, 2);
    if (others.length < 1) return;
    auto.push({ type: k % 2 ? "meaning" : "listen", item: w.it, choices: [w.it, ...others.map(x => x.it)], key: w.star });
  });
  // q:파일/비교id/번호 는 그 파일의 퀴즈를 불러온다 (오늘의 복습 key도 그 퀴즈 key)
  const out = [];
  for (const x of [...auto, ...own].slice(0, 5)) {
    if (!x.ref) { out.push(x); continue; }
    const q = await questionOfKey(`quiz:${lang}/${x.ref.file}/${x.ref.id}/${x.ref.idx}`);
    if (q) out.push(q);
  }
  return out;
}
