/* speech.js — 따라 말하기: 브라우저 내장 음성 인식(Web Speech API)과 정답 비교
   서버·유료 서비스는 쓰지 않는다. 다만 브라우저 음성 인식은 말소리를 Google 등 브라우저 회사 서버로 보내므로
   처음 쓸 때 한 번 알린다(views.js). 인식기가 없는 브라우저에서는 🎤를 숨긴다. */

const speech = {
  Rec: window.SpeechRecognition || window.webkitSpeechRecognition || null,
  supported() { return !!this.Rec; },
  current: null,

  // 한 번 듣고 후보 문장들을 돌려준다. 실패하면 Error(code): no-speech, not-allowed, network, aborted …
  listen(langTag) {
    return new Promise((resolve, reject) => {
      if (!this.Rec) return reject(new Error("unsupported"));
      this.stop();
      const r = new this.Rec();
      r.lang = langTag;
      r.interimResults = false;
      r.continuous = false;
      r.maxAlternatives = 5;
      let done = false;
      r.onresult = e => {
        done = true;
        const res = e.results[0];
        const alts = [];
        for (let i = 0; i < res.length; i++) if (res[i].transcript) alts.push(res[i].transcript);
        resolve(alts);
      };
      r.onerror = e => { done = true; reject(new Error(e.error || "error")); };
      r.onend = () => { this.current = null; if (!done) reject(new Error("no-speech")); };
      this.current = r;
      r.start();
    });
  },
  stop() { try { this.current?.abort(); } catch {} this.current = null; },

  // 비교용으로 고르기: 띄어쓰기·문장부호·대소문자 무시. 일본어는 가타카나→히라가나, 영어는 숫자→단어, 아포스트로피 무시.
  normalize(lang, s) {
    let t = String(s || "").normalize("NFKC").toLowerCase();
    if (lang === "ja") {
      t = t.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
    } else {
      t = t.replace(/['’]/g, "").replace(/\d+/g, n => " " + numberWords(Number(n)) + " ");
    }
    return t.replace(/[\s\p{P}\p{S}]/gu, "");
  },

  similarity(a, b) {
    if (!a.length && !b.length) return 1;
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - d[m][n] / Math.max(m, n);
  },

  // heard: 인식 후보들, answers: 정답 표기들(히라가나·한자 등). level: ok(맞음) | close(80% 이상) | retry
  judge(lang, heard, answers) {
    let best = { score: -1, heard: heard[0] || "" };
    for (const h of heard) for (const a of answers) {
      const s = this.similarity(this.normalize(lang, h), this.normalize(lang, a));
      if (s > best.score) best = { score: s, heard: h };
    }
    const level = best.score >= 1 ? "ok" : best.score >= 0.8 ? "close" : "retry";
    return { level, heard: best.heard, score: best.score };
  }
};

// ── ⏺ 녹음 (MediaRecorder) ───────────────────────
// 녹음은 휴대폰 메모리(blob URL)에만 둔다. 서버로 보내지도, 저장소에 저장하지도 않는다.
// 화면을 떠나거나 다른 문장으로 바꾸면 clear()로 지우고 마이크를 끈다. 네트워크를 쓰지 않아 오프라인에서도 된다.
const recorder = {
  MAX_MS: 6000,
  stream: null, rec: null, url: null, timer: null, audio: null, owner: null, discard: false, lastSize: 0,
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
  recording() { return !!(this.rec && this.rec.state === "recording"); },

  // 녹음을 시작한다. 끝나면 onDone(true) (녹음 있음), 지워졌으면 onDone(false). 실패하면 Error(name).
  async start(owner, onDone) {
    this.clear();
    this.owner = owner;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
      .find(t => window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    this.discard = false;
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearTimeout(this.timer);
      this.releaseMic();
      if (this.discard || !chunks.length) { onDone(false); return; }
      const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
      this.lastSize = blob.size;
      this.url = URL.createObjectURL(blob);
      onDone(true);
    };
    this.rec = rec;
    rec.start();
    this.timer = setTimeout(() => this.stop(), this.MAX_MS);
  },
  stop() { if (this.recording()) this.rec.stop(); },
  releaseMic() { this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; },
  play() {
    return new Promise(resolve => {
      if (!this.url) return resolve();
      this.stopPlayback();
      this.audio = new Audio(this.url);
      this.audio.onended = this.audio.onerror = () => resolve();
      this.audio.play().catch(() => resolve());
    });
  },
  stopPlayback() { if (this.audio) { this.audio.pause(); this.audio = null; } },
  // 녹음·재생을 멈추고, 녹음을 지우고, 마이크를 끈다
  clear() {
    clearTimeout(this.timer);
    if (this.recording()) { this.discard = true; this.rec.stop(); }
    this.rec = null;
    this.releaseMic();
    this.stopPlayback();
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    this.owner = null;
  }
};
addEventListener("pagehide", () => recorder.clear());

// 0~100 영어 숫자 (인식기가 "2 dollars"처럼 숫자로 돌려줄 때 "two"와 맞추려고)
function numberWords(n) {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (!Number.isFinite(n) || n < 0 || n > 100) return String(n);
  if (n === 100) return "one hundred";
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}
