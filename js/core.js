/* core.js — 설정, 데이터 불러오기, 발음 듣기, 공통 도우미 */

// ── 언어·섹션 정의 ──────────────────────────────
// 새 섹션을 열려면: data/<언어>/<id>.json을 만들고 ready를 true로 바꾼다.
// type: cards(단어 카드) | patterns(패턴) | situations(상황별 회화) | conjugation(동사 변형 표) | particles(조사) | pairs(발음 연습)
const LANGS = {
  en: {
    name: "영어", big: "Aa", desc: "다섯 살 아이처럼, 소리와 단어부터",
    voice: "en-US",
    tips: true,   // data/en/tips.json (💡 알아두기)
    sections: [
      { id: "words",      type: "cards",      name: "기초 단어",   desc: "주제별 단어 카드", ready: true },
      { id: "verbs",      type: "cards",      name: "동사",       desc: "매일 쓰는 동작 말", ready: true },
      { id: "function_words", type: "particles", unit: "작은 말", name: "작은 말", desc: "and·to·my·the·me 같은 말", ready: true },
      { id: "patterns",   type: "patterns",   name: "패턴 영어",   desc: "문장 틀에 단어 바꿔 넣기", ready: true },
      { id: "situations", type: "situations", name: "상황별 회화", desc: "공항·호텔·식당·교통·카페·병원 등 12개 장면", ready: true },
      { id: "pairs",      type: "pairs",      name: "발음 연습",   desc: "r/l · f/p · v/b · th/s · i/ee 헷갈리는 짝", ready: true }
    ]
  },
  ja: {
    name: "일본어", big: "あ", desc: "기초 단어, 조사, 동사 변형까지",
    voice: "ja-JP",
    sections: [
      { id: "words",      type: "cards",      name: "기초 단어",   desc: "주제별 단어 카드", ready: true },
      { id: "particles",  type: "particles",  unit: "조사", name: "조사",       desc: "は·の·も → を·に·で·へ → と·が, 헷갈리는 조사 비교", ready: true },
      { id: "verbs",      type: "conjugation", name: "동사 변형",  desc: "1·2·3형 × ます·て·た·ない·たい형", ready: true },
      { id: "situations", type: "situations", name: "상황별 회화", desc: "공항·호텔·식당·교통·카페·병원 등 12개 장면", ready: true },
      { id: "pairs",      type: "pairs",      name: "발음 연습",   desc: "장음 · っ · か/が · ざ/じゃ 헷갈리는 짝", ready: true }
    ]
  }
};

// ── 데이터 불러오기 ─────────────────────────────
// 미리보기 파일에는 window.EMBEDDED_DATA로 데이터가 들어 있고,
// 실제 사이트에서는 data/<언어>/<섹션>.json을 불러온다.
const cache = {};
async function loadData(lang, section) {
  const key = `${lang}/${section}`;
  if (cache[key]) return cache[key];
  if (window.EMBEDDED_DATA && window.EMBEDDED_DATA[key]) {
    return (cache[key] = window.EMBEDDED_DATA[key]);
  }
  const res = await fetch(`data/${key}.json`);
  if (!res.ok) throw new Error(`${key}.json을 불러오지 못했어요 (${res.status})`);
  return (cache[key] = await res.json());
}

// ── 발음 듣기 (브라우저 내장 음성) ──────────────
// 설명 조각의 lang → 목소리
const VOICE_OF = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };
const LANG_NAME = { ko: "한국어", en: "영어", ja: "일본어" };

const tts = {
  voices: [],
  rate: 0.85,
  run: null,        // 지금 읽는 speakAll (멈추면 null, 끝났다고 알린다)
  watchers: [],     // 음성 목록이 늦게 도착하면 부를 함수들 (화면을 바꿀 때 app.js route가 비운다)
  init() {
    if (!("speechSynthesis" in window)) return;
    const load = () => { this.voices = speechSynthesis.getVoices(); this.watchers.forEach(f => f()); };
    load();
    speechSynthesis.onvoiceschanged = load;
  },
  pick(langTag) {
    const base = langTag.split("-")[0];
    return this.voices.find(v => v.lang === langTag) ||
           this.voices.find(v => v.lang && v.lang.replace("_", "-").startsWith(base));
  },
  // 이 기기에 그 언어 음성이 있는지: true / false / null(아직 목록을 못 받아 모름)
  has(langTag) {
    if (!("speechSynthesis" in window)) return false;
    return this.voices.length ? !!this.pick(langTag) : null;
  },
  watch(fn) { this.watchers.push(fn); },
  stop() {
    const run = this.run;
    this.run = null;
    window.speechSynthesis?.cancel();
    run?.done();
  },
  utter(text, langTag) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langTag;
    u.rate = this.rate;
    const v = this.pick(langTag);
    if (v) u.voice = v;
    return u;
  },
  // 한 문장 읽기
  speak(text, langTag, btn) {
    if (!("speechSynthesis" in window)) { toast("이 브라우저는 발음 듣기를 지원하지 않아요"); return; }
    this.stop();
    if (this.voices.length && !this.pick(langTag)) toast("이 기기에 해당 언어 음성이 없어 기본 음성으로 읽어요");
    const u = this.utter(text, langTag);
    if (btn) {
      btn.classList.add("playing");
      u.onend = u.onerror = () => btn.classList.remove("playing");
    }
    speechSynthesis.speak(u);
  },
  // 여러 문장을 차례로 읽기 (대화 전체 듣기, 설명 듣기)
  // items: 문자열(langTag 목소리) 또는 { lang: "ko"|"en"|"ja", text, silent?, gap? } 조각 — 조각마다 그 언어 목소리로 바꿔 읽는다.
  // gap: 다음 조각까지 쉬는 시간(ms, 기본 350). silent 조각은 건너뛴다. onLine(i)은 읽기 시작하는 조각 번호.
  speakAll(items, langTag, onLine, onDone) {
    if (!("speechSynthesis" in window)) { toast("이 브라우저는 발음 듣기를 지원하지 않아요"); return; }
    this.stop();
    // onDone(결과): 끝까지 읽음 true, 읽기 오류 "error", 멈춤(tts.stop·다른 읽기 시작) false
    const run = { done: (finished = false) => { if (run.over) return; run.over = true; onDone && onDone(finished); } };
    this.run = run;
    let i = 0;
    const next = () => {
      if (this.run !== run) return;                                  // 멈췄거나 다른 읽기가 시작됨
      while (i < items.length && items[i] && items[i].silent) i++;
      if (i >= items.length) { this.run = null; run.done(true); return; }
      const it = typeof items[i] === "string" ? { text: items[i] } : items[i];
      onLine && onLine(i);
      const u = this.utter(it.text, VOICE_OF[it.lang] || it.lang || langTag);
      u.onend = () => { const gap = it.gap ?? 350; i++; setTimeout(next, gap); };
      u.onerror = () => { if (this.run === run) { this.run = null; run.done("error"); } };
      speechSynthesis.speak(u);
    };
    next();
  }
};

// ── 공통 도우미 ─────────────────────────────────
const app = document.getElementById("app");
const titleEl = document.getElementById("pageTitle");
const backBtn = document.getElementById("backBtn");
let backTarget = null;

function setHeader(title, back) {
  titleEl.textContent = title;
  backTarget = back;
  backBtn.hidden = !back;
}
backBtn.addEventListener("click", () => { if (backTarget) location.hash = backTarget; });

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 휴대폰 브라우저 저장소(localStorage). 시크릿 창 등에서 막혀 있으면 기록 없이 동작한다.
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
};

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

// 카드 좌우로 밀어서 넘기기
function addSwipe(el, onLeft, onRight) {
  let x0 = null;
  el.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (dx < -50) onLeft();
    else if (dx > 50) onRight();
  });
}

function progressBar(i, n) {
  return `<div class="progress">
    <div class="bar"><i style="width:${((i + 1) / n) * 100}%"></i></div>
    <span>${i + 1} / ${n}</span></div>`;
}

function errorView(e) {
  app.innerHTML = `<p class="lead">${esc(e.message)}. 인터넷 연결을 확인하고 다시 열어 주세요.</p>`;
}
