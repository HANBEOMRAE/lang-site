/* app.js — 주소(#)에 따라 화면 고르기 */
//  #/                       언어 고르기
//  #/en                     섹션 목록
//  #/en/words               주제 목록        #/en/words/2/5   주제 2의 6번째 카드
//  #/en/patterns            패턴 목록        #/en/patterns/0/3 패턴 0의 4번째 문장   #/en/patterns/vs/1  2번째 비교
//  #/en/situations          장면 목록        #/en/situations/3 장면 3
//  #/ja/verbs               동사 변형 표     #/ja/verbs/4      5번째 동사 상세
//  #/ja/stars               헷갈린 단어(☆) 모아 보기   #/ja/stars/2  3번째 카드
//  #/en/pairs               발음 연습 목록   #/en/pairs/0      짝 연습   #/en/pairs/weak  내 발음 약점
//  #/ja/particles           조사 목록        #/ja/particles/4  5번째 조사   #/ja/particles/vs/1  2번째 비교

function route() {
  tts.stop();
  speech.stop();
  window.scrollTo(0, 0);
  const [lang, secId, a, b] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!lang || !LANGS[lang]) return viewHome();
  document.body.className = `lang-${lang}`;
  if (secId !== "stars") starSnap = null;     // 헷갈린 단어 모아 보기에서 나가면 순서를 새로 정한다
  if (!secId) return viewLang(lang);
  if (secId === "stars") return viewStars(lang, a === undefined ? 0 : Number(a));
  const sec = LANGS[lang].sections.find(s => s.id === secId && s.ready);
  if (!sec) return viewLang(lang);
  const A = a === undefined ? undefined : Number(a);
  const B = Number(b || 0);

  switch (sec.type) {
    case "cards":      return A === undefined ? viewCategories(lang, sec) : viewCards(lang, sec, A, B);
    case "patterns":   return A === undefined ? viewPatternList(lang, sec)
                            : a === "vs" ? viewPatternCompare(lang, sec, B) : viewPattern(lang, sec, A, B);
    case "situations": return A === undefined ? viewSceneList(lang, sec)  : viewScene(lang, sec, A);
    case "conjugation": return A === undefined ? viewConjTable(lang, sec) : viewVerb(lang, sec, A);
    case "pairs":      return A === undefined ? viewPairList(lang, sec)
                            : a === "weak" ? viewWeak(lang, sec) : viewPairs(lang, sec, A);
    case "particles":  return A === undefined ? viewParticleList(lang, sec)
                            : a === "vs" ? viewCompare(lang, sec, B) : viewParticle(lang, sec, A);
    default:           return viewLang(lang);
  }
}

// data-go가 붙은 버튼은 그 주소로 이동
app.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b) location.hash = b.dataset.go;
});
// PC 키보드: ← → 로 넘기기
document.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") document.getElementById("next")?.click();
  if (e.key === "ArrowLeft") document.getElementById("prev")?.click();
});

window.addEventListener("hashchange", route);
tts.init();
route();

// ── 오프라인(PWA) ────────────────────────────────
// 서버로 열었을 때만(GitHub Pages·로컬 서버) 등록한다. 더블클릭으로 연 미리보기 파일에서는 건너뛴다.
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(reg => {
    reg.active.postMessage("check-update");   // 뒤에서 새 버전 확인
    reg.active.postMessage("warm-fonts");     // 글꼴 조각 저장
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("message", e => {
    if (e.data && e.data.type === "updated") showUpdateBar();
  });
  // sw.js 자체가 바뀌어 새 서비스 워커가 자리 잡은 경우 (첫 설치 때는 알리지 않는다)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) showUpdateBar();
    hadController = true;
  });
}

function showUpdateBar() {
  if (document.getElementById("updateBar")) return;
  const bar = document.createElement("div");
  bar.id = "updateBar";
  bar.className = "update-bar";
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span>새 버전으로 업데이트됐어요</span>
    <button class="chip on" id="updateReload">새로 보기</button>
    <button class="update-close" id="updateClose" aria-label="닫기">×</button>`;
  document.body.appendChild(bar);
  document.getElementById("updateReload").onclick = () => location.reload();
  document.getElementById("updateClose").onclick = () => bar.remove();
}
