/* app.js — 주소(#)에 따라 화면 고르기 */
//  #/                       언어 고르기
//  #/en                     섹션 목록
//  #/en/words               주제 목록        #/en/words/2/5   주제 2의 6번째 카드
//  #/en/patterns            패턴 목록        #/en/patterns/0/3 패턴 0의 4번째 문장
//  #/en/situations          장면 목록        #/en/situations/3 장면 3
//  #/ja/verbs               동사 변형 표     #/ja/verbs/4      5번째 동사 상세

function route() {
  tts.stop();
  window.scrollTo(0, 0);
  const [lang, secId, a, b] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!lang || !LANGS[lang]) return viewHome();
  document.body.className = `lang-${lang}`;
  if (!secId) return viewLang(lang);
  const sec = LANGS[lang].sections.find(s => s.id === secId && s.ready);
  if (!sec) return viewLang(lang);
  const A = a === undefined ? undefined : Number(a);
  const B = Number(b || 0);

  switch (sec.type) {
    case "cards":      return A === undefined ? viewCategories(lang, sec) : viewCards(lang, sec, A, B);
    case "patterns":   return A === undefined ? viewPatternList(lang, sec) : viewPattern(lang, sec, A, B);
    case "situations": return A === undefined ? viewSceneList(lang, sec)  : viewScene(lang, sec, A);
    case "conjugation": return A === undefined ? viewConjTable(lang, sec) : viewVerb(lang, sec, A);
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
