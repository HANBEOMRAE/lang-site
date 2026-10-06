/* core.js — 설정, 데이터 불러오기, 발음 듣기, 공통 도우미 */

// ── 언어·섹션 정의 ──────────────────────────────
// 새 섹션을 열려면: data/<언어>/<id>.json을 만들고 ready를 true로 바꾼다.
// type: cards(단어 카드) | patterns(패턴) | situations(상황별 회화) | conjugation(동사 변형 표)
const LANGS = {
  en: {
    name: "영어", big: "Aa", desc: "다섯 살 아이처럼, 소리와 단어부터",
    voice: "en-US",
    sections: [
      { id: "words",      type: "cards",      name: "기초 단어",   desc: "주제별 단어 카드", ready: true },
      { id: "verbs",      type: "cards",      name: "동사",       desc: "매일 쓰는 동작 말", ready: true },
      { id: "patterns",   type: "patterns",   name: "패턴 영어",   desc: "문장 틀에 단어 바꿔 넣기", ready: true },
      { id: "situations", type: "situations", name: "상황별 회화", desc: "공항·호텔·식당·교통·카페·병원 등 12개 장면", ready: true }
    ]
  },
  ja: {
    name: "일본어", big: "あ", desc: "기초 단어, 조사, 동사 변형까지",
    voice: "ja-JP",
    sections: [
      { id: "words",      type: "cards",      name: "기초 단어",   desc: "주제별 단어 카드", ready: true },
      { id: "particles",  type: "cards",      name: "조사",       desc: "は・が・を・に・で…", ready: false },
      { id: "verbs",      type: "conjugation", name: "동사 변형",  desc: "1·2·3형 × ます·て·た·ない·たい형", ready: true },
      { id: "situations", type: "situations", name: "상황별 회화", desc: "공항·호텔·식당·교통·카페·병원 등 12개 장면", ready: true }
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
const tts = {
  voices: [],
  rate: 0.85,
  init() {
    if (!("speechSynthesis" in window)) return;
    const load = () => (this.voices = speechSynthesis.getVoices());
    load();
    speechSynthesis.onvoiceschanged = load;
  },
  pick(langTag) {
    const base = langTag.split("-")[0];
    return this.voices.find(v => v.lang === langTag) ||
           this.voices.find(v => v.lang && v.lang.replace("_", "-").startsWith(base));
  },
  stop() { window.speechSynthesis?.cancel(); },
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
  // 여러 문장을 차례로 읽기 (대화 전체 듣기)
  speakAll(texts, langTag, onLine, onDone) {
    if (!("speechSynthesis" in window)) { toast("이 브라우저는 발음 듣기를 지원하지 않아요"); return; }
    this.stop();
    let i = 0;
    const next = () => {
      if (i >= texts.length) { onDone && onDone(); return; }
      onLine && onLine(i);
      const u = this.utter(texts[i], langTag);
      u.onend = () => { i++; setTimeout(next, 350); };
      u.onerror = () => onDone && onDone();
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
