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
