# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

영어·일본어 기초 회화 학습 사이트("첫말"). 빌드 도구 없는 정적 사이트(HTML + 순수 JS + JSON)다. 데이터 형식별 예시는 `README.md`에 있다.

## 명령

```
python -m http.server 5500      # 사이트 실행 → http://localhost:5500 (index.html 직접 열면 JSON fetch 실패)
python tools/validate.py        # 데이터 검사 (테스트 대신 이것)
python tools/build_preview.py   # dist/preview.html 한 파일 미리보기 (서버 없이 열림)
```

## 구조

- `js/core.js`의 `LANGS`가 언어·섹션 목록의 기준이다. 섹션마다 `id`(= `data/<언어>/<id>.json`), `type`, `ready`가 있다.
- `js/app.js`가 `#/<언어>/<섹션>/<a>/<b>` 주소를 읽고 섹션 `type`에 따라 `views.js`의 화면 함수를 고른다.
  type: `cards`, `patterns`, `situations`, `conjugation`(일본어 동사 변형 표), `particles`(일본어 조사, `#/ja/particles/vs/<n>`은 비교).
- 조사 예문의 `[조사]` 표시는 화면에서 강조(`markParticle`)로, 발음 듣기·검사에서는 괄호를 뺀 문장(`plainText`)으로 쓴다.
  `uses`는 쓰임별 묶음, `words`는 예문에 쓴 `ja/words.json` 단어 목록이다.
- 스크립트는 모듈 없이 `core.js → speech.js → views.js → app.js` 순서로 불러오는 전역 함수 방식이다.
- 🎤 따라 말하기: `speech.js`가 인식·비교(띄어쓰기·문장부호·대소문자 무시, 일본어 가타카나→히라가나, 영어 숫자→단어)를 하고,
  `views.js`의 `sayToolsHTML`/`bindSayTools`/`attachInlineTools`가 화면에 붙인다. 일본어 문장은 `text`와 `kanji_text`(단어 카드 예문은 `example_kanji_text`)를 둘 다 정답으로 쓴다.
  새 일본어 문장에는 `kanji_text`도 넣는다(README "일본어 문장의 한자 표기").
- ⏺ 녹음: `speech.js`의 `recorder`(MediaRecorder). 녹음은 blob URL로 메모리에만 두고 한 번에 하나만 가진다.
  화면 이동(app.js `route`), 다른 문장 선택(`attachInlineTools`), 페이지 닫기(`pagehide`) 때 `recorder.clear()`로 지우고 마이크를 끈다. 녹음을 서버나 저장소로 보내는 코드를 넣지 않는다.
- `loadData`는 `window.EMBEDDED_DATA`(미리보기 파일)가 있으면 그걸 쓰고, 없으면 `data/…json`을 fetch한다.
- 새 섹션 열기: JSON 만들기 → `LANGS`에서 `ready: true` → `validate.py`. 새 `type`이면 `app.js`의 switch와 `views.js` 화면도 추가한다.
- `validate.py`는 파일 이름(`CHECKERS`)으로 검사기를 고르고, 같은 이름인데 언어별로 형식이 다르면 `CHECKERS_BY_LANG`(예: `ja/verbs`)이 우선한다.
  같은 `verbs.json`이라도 `en`은 카드 목록, `ja`는 `{groups, forms, verbs}`다.
- 색은 `css/style.css` 맨 위 `:root` 변수만 쓴다(다크 모드 포함). 일본어 화면은 `body.lang-ja`에서 `--accent`가 빨강이 된다.
- 기록은 `localStorage`에 둔다. `core.js`의 `store.get/set`(JSON, try/catch로 막힌 환경에서도 동작)을 쓴다.
  키: `lastPlace`(이어서 하기, 언어별 `{ref, time}`), `stars`(헷갈린 단어, `"언어/섹션/주제/단어"` 목록 — 동사 변형은 주제 자리에 `-`), `pairStats`(발음 연습, `"언어/짝id"`별 `{right, wrong, last}`), `speechNotice`(🎤 안내를 봤는지), `hideMeaning`.
  이어서 하기와 ☆는 번호가 아니라 이름(섹션·주제·항목 text, 패턴 틀·바꿔 넣는 말, 비교 id, 장면 이름)으로 저장하고, 열 때 지금 번호를 찾는다
  (views.js `resolvePlace`). 주제 이름이나 항목 `text`를 바꾸면 그 기록은 찾을 수 없게 되어 조용히 빠진다(☆는 "찾을 수 없는 표시"로 알림).
- 오프라인(PWA): `sw.js`가 `PRECACHE`(화면 파일·데이터 전체)를 저장하고 저장본을 먼저 쓴다. 페이지를 열 때마다 뒤에서 새 버전을 확인해
  `chotmal-app-next`에 전부 받아 두고 알림을 띄운 뒤, 다음 페이지 열기(navigate) 때 한꺼번에 바꾼다(옛 코드 + 새 데이터가 섞이지 않게).
  `data/`·`js/`·`css/`·`icons/`에 파일을 추가하면 `PRECACHE`에도 넣는다(`validate.py`가 검사). 서비스 워커는 `http(s)`로 열 때만 등록된다(미리보기 파일 제외).

## 작업 규칙

1. 모든 단어와 문장에는 한글 발음(`ko_pron`)과 뜻(`meaning`)을 반드시 넣는다.
2. 다섯 살 원어민 아이 수준의 쉽고 자주 쓰는 표현으로 만든다.
3. 데이터를 고친 뒤에는 항상 `python tools/validate.py`를 실행해서 문제가 없는지 확인한다.
4. 코드를 바꿀 때는 무엇을 왜 바꾸는지 먼저 설명한다.
5. 큰 작업이 하나 끝나서 검사(`validate.py`)를 통과하면, 커밋할지 사용자에게 먼저 묻는다. 묻지 않고 커밋하지 않는다.

## 패턴 단어별 뜻 (`patterns.json`의 `words`)

- 틀 단어(I, want, to…)의 뜻은 패턴의 `words`에 한 번만 적는다. 바꿔 넣는 말의 단어 뜻은 그 말(`fills[].words`)에 적는다.
- a, the, my처럼 한 패턴의 여러 말에 **같은 뜻**으로 반복되는 작은 단어는 패턴 `words`에 한 번만 적어도 된다(기본값).
- 같은 단어라도 문장에 따라 뜻이 다르면 바꿔 넣는 말 쪽에 적는다. 그쪽이 우선하고, 패턴 쪽은 기본값으로만 쓴다.
  예: "I want to eat"의 to(~하기를)와 "go to the beach"의 to(~로). for, on, in, at, by, take, have, get도 같은 규칙.
- 찾는 순서는 문장 속 자리로 정한다: 틀 자리 단어 → 패턴 `words`, 바꿔 넣는 말 자리 단어 → 그 말 `words` → 패턴 `words`.
  (views.js `bindWordGloss`, validate.py `check_word_glosses`가 같은 규칙. 문장의 모든 단어에 뜻이 있어야 검사를 통과한다.)
- 단어 키는 소문자. 문장부호는 떼고, I'm·don't·kids' 같은 말은 한 단어로 본다. `I'm ___ing`은 문장에 나오는 형태(eating)로 적는다.

## 일본어 띄어쓰기

- 단어 카드의 `text`와 예문 모두 단어 단위로 띄어 쓴다. 조사와 です·ます는 앞말에 붙인다.
  예: ありがとう ございます, おうふくで おねがいします, よやく して います
- 카드의 큰 글자는 한 줄로 두고 최소 36px까지 줄인다. 그보다 작아져야 하면 띄어쓰기 자리에서 줄을 바꾼다(views.js `fitWord`). 그래서 긴 표현은 띄어 써야 두 줄로 나뉠 수 있다.

## 일본어 한글 발음(ko_pron) 표기 규칙

소리를 먼저 배우는 사이트라, 발음 듣기(ja-JP 음성)에서 들리는 소리에 맞춘다.

- **긴 소리는 `-`로 쓴다.** おお·おう(오-), うう(우-), いい(이-), ー 모두 해당한다.
  예: おおさか 오-사카, ありがとう 아리가토-, くうこう 쿠-코-, いいです 이-데스, タクシー 타쿠시-
- **장음 바로 뒤에 ん이 오면 장음 모음을 한 번 더 쓰고 ㄴ받침을 붙인다.** 예: スプーン 스푸운, コーン 코온
- **えい도 `-`로 쓴다.** 예: せんせい 센세-, がくせい 가쿠세-
  단, 단어 경계에서 え와 い가 만나면 "에이"로 둔다(장음이 아님).
- **작은 っ는 항상 ㅅ받침으로 쓴다.** 예: がっこう 갓코-, きっぷ 킷푸, チェック 쳇쿠
- **ん은 항상 ㄴ으로 쓴다.** 예: なんば 난바, げんきん 겐킨, パン 판
- **か·た행은 단어 첫머리에서도 격음으로 쓴다.** 예: か 카, た 타
- **つ→츠, ず·づ→즈, じ·ぢ→지, ふ→후로 쓴다.**
- **ㅈ·ㅊ 뒤 요음은 y를 빼고 쓴다.** 한국어에서 쥬와 주처럼 소리가 구분되지 않기 때문이다(국립국어원 표기).
  じゃ·じゅ·じょ → 자·주·조, ちゃ·ちゅ·ちょ → 차·추·초.
  しゃ·しゅ·しょ → 샤·슈·쇼는 ㅅ 뒤 y가 소리로 구분되니 그대로 둔다.
- **조사는 소리대로 쓴다.** は→와, へ→에, を→오
- **문장부호:** 。→ `.` (묻는 말은 `?`), ？→ `?`, 、→ `,`
- **숫자는 음성이 읽는 대로 쓴다.** 예: 502ごうしつ 고햐쿠니 고-시츠
