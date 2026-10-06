# 첫말 — 영어·일본어 기초 회화

원어민 다섯 살 아이가 말을 배우듯, 단어와 소리부터 익히는 개인 학습 사이트.
HTML + JavaScript + JSON으로 만든 정적 사이트라 서버 없이 올릴 수 있다.

## VS Code에서 시작하기

1. VS Code에서 `파일 > 폴더 열기`로 이 `lang-site` 폴더를 연다.
2. 오른쪽 아래에 추천 확장 설치 안내가 뜨면 설치한다 (Live Server, Prettier, Python).
3. 사이트 실행 — 둘 중 하나:
   - `index.html`을 열고 오른쪽 아래 **Go Live** 클릭
   - 또는 `Ctrl+Shift+P` → `Tasks: Run Task` → **사이트 실행 (로컬 서버)** 후 브라우저에서 `http://localhost:5500`
4. 휴대폰으로 확인: PC와 같은 와이파이에서 `http://<PC의 IP>:5500` 접속.
   PC IP는 터미널에서 `ipconfig`(윈도우)로 확인.

> `index.html`을 더블클릭으로 바로 열면 데이터(JSON)를 못 불러온다. 브라우저 보안 때문이라 꼭 3번처럼 서버로 연다.
> 서버 없이 보고 싶으면 아래 "미리보기 한 파일 만들기"를 쓴다.

## 폴더 구조

```
lang-site/
  index.html            화면 틀
  css/style.css         디자인 (색은 맨 위 :root 변수에서 바꾼다)
  js/core.js            언어·섹션 설정, 데이터 불러오기, 발음 듣기
  js/speech.js          따라 말하기: 음성 인식, 정답 비교, 녹음
  js/views.js           화면 그리기 (카드, 패턴, 상황별 회화)
  js/app.js             주소(#)에 따라 화면 고르기
  data/en/              영어 데이터
    words.json          기초 단어 (주제별)
    verbs.json          동사 (주제별)
    patterns.json       패턴 영어
    pattern_compare.json 비슷한 패턴 비교 (I want to/I need to 등)
    pairs.json          발음 연습: 헷갈리는 짝 (r/l, f/p, v/b, th/s, i/ee)
    situations.json     상황별 회화
  data/ja/              일본어 데이터
    words.json          기초 단어 (주제별, kanji·예문 발음 포함)
    verbs.json          동사 변형 (1·2·3형 × 활용형 표)
    particles.json      조사 (쓰임별 예문, 헷갈리는 조사 비교, 퀴즈 데이터)
    pairs.json          발음 연습: 헷갈리는 짝 (장음, っ, か/が, ざ·ず/じゃ·じゅ)
    situations.json     상황별 회화 (영어와 같은 형식)
  sw.js                 오프라인용 서비스 워커 (저장할 파일 목록 PRECACHE)
  manifest.webmanifest  홈 화면에 추가할 때의 앱 이름·아이콘
  icons/                앱 아이콘 (192·512px, 아이폰용 180px)
  tools/validate.py     데이터 검사 (+ sw.js 저장 목록 검사)
  tools/build_preview.py 한 파일 미리보기 만들기 → dist/preview.html
```

## 휴대폰에서 매일 쓰기

- **이어서 하기**: 마지막으로 본 카드·패턴·장면·동사 위치를 언어별로 기억해, 첫 화면과 언어 홈 맨 위에 보여 준다.
- **🎤 따라 말하기**: 단어 카드·예문·패턴 문장·상황별 회화·조사 예문에서 따라 말하면 "이렇게 들렸어요"와 함께 맞았어요 / 거의 맞았어요(80% 이상) / 다시 해 봐요를 보여 준다.
  브라우저 내장 음성 인식을 써서 말소리가 Google 서버로 전송되고(처음 한 번 안내), 인터넷이 필요하다. 지원하지 않는 브라우저에서는 🎤가 숨겨진다.
- **⏺ 녹음해서 비교하기**: 🎤 옆 ⏺로 내 목소리를 녹음(최대 6초)하고 ▶ 내 목소리, 🔁 번갈아(원어민 🔊 → 내 녹음)로 들어 본다.
  녹음은 휴대폰 메모리에만 있고 밖으로 보내지 않는다. 화면을 떠나거나 다른 문장으로 바꾸면 지워진다. 오프라인에서도 된다.
- **발음 연습 · 내 발음 약점**: 소리 하나만 다른 짝으로 "듣고 고르기"(오프라인 가능)와 "말해 보기"(🎤)를 한다. 틀리면 입 모양 팁을 보여 주고, 짝별 맞음·틀림을 모아 틀린 비율이 높은 짝부터 보여 준다.
- **헷갈린 단어 ☆**: 단어 카드와 동사 변형 카드 오른쪽 위 ☆를 누르면 표시된다. 언어 홈의 "헷갈린 단어"에서 표시한 카드만 모아 본다.
- **오프라인**: 한 번 열면(GitHub Pages 등 서버로 연 경우) 인터넷 없이도 열린다. 데이터 전체와 쓰인 글자의 글꼴 조각을 저장해 둔다.
  새 버전을 올리면 다음에 열 때 위쪽에 "새 버전으로 업데이트됐어요" 알림이 뜨고, **새로 보기**를 누르면 바뀐다.
- **홈 화면에 추가**: 안드로이드 Chrome은 메뉴(⋮) → "홈 화면에 추가", 아이폰 Safari는 공유 → "홈 화면에 추가". 앱처럼 전체 화면으로 열린다.

> 기록(이어서 하기·☆·뜻 가리기)은 그 휴대폰 브라우저에만 저장된다. 다른 기기와 동기화되지 않고, 브라우저 데이터를 지우면 사라진다.
> 오프라인에서 발음 듣기는 휴대폰에 영어·일본어 음성이 설치되어 있어야 들린다.

`data/`·`js/`·`css/`·`icons/`에 **새 파일을 추가하면 `sw.js`의 `PRECACHE`에도 넣는다.** 빠뜨리면 `validate.py`가 알려 준다.

## 데이터 늘리는 법

코드는 건드리지 않고 `data/` 안의 JSON만 고치면 된다. 고친 뒤에는 꼭 검사를 돌린다.

```
python tools/validate.py
```

### 기초 단어·동사 (words.json, verbs.json)

```json
{
  "category": "음식",
  "emoji": "🍎",
  "items": [
    { "text": "water", "ko_pron": "워터", "meaning": "물",
      "example": "I need water.", "example_meaning": "물이 필요해." }
  ]
}
```

새 주제는 배열에 `{ category, emoji, items }`를 하나 더 넣는다. `example`은 없어도 된다.

일본어 기초 단어(`ja/words.json`)는 같은 형식에 두 칸이 더 있다.

```json
{ "text": "おかあさん", "kanji": "お母さん", "ko_pron": "오카-산", "meaning": "엄마",
  "example": "おかあさん だいすき。", "example_ko_pron": "오카-산 다이스키.", "example_meaning": "엄마 정말 좋아." }
```

- `text`와 `example`은 히라가나(외래어는 가타카나)로만 쓴다.
- `kanji`는 보통 한자로 쓰는 단어만 넣고, 아니면 `null`. 화면에서 히라가나 아래에 작게 보인다.
- 예문이 있으면 `example_ko_pron`도 꼭 넣는다. 한글 발음은 CLAUDE.md의 표기 규칙을 따른다.

### 발음 연습: 헷갈리는 짝 (pairs.json)

```json
{ "sets": [
  { "id": "r-l", "name": "r / l", "sounds": ["r", "l"],
    "tips": { "r": "혀끝을 … 뒤로 살짝 말고 …", "l": "혀끝을 윗니 뒤 잇몸에 …" },
    "pairs": [ { "a": { "text": "right", "ko_pron": "라잇", "meaning": "오른쪽" },
                 "b": { "text": "light", "ko_pron": "라잇", "meaning": "빛, 불" } } ] } ] }
```

- 소리 하나만 다른 단어 짝을 4~6쌍. `a`는 `sounds[0]`, `b`는 `sounds[1]` 소리다. 일본어는 `kanji` 칸도 넣는다(없으면 `null`).
- 한글 발음은 두 단어 모두 평소 표기 그대로 쓴다(같아도 된다). 같으면 화면에 "한글로는 구분이 안 돼요. 귀로 들어 보세요"가 뜬다.
- 화면은 두 단어에서 다른 글자를 자동으로 강조한다(앞뒤 같은 글자를 뺀 가운데). 그래서 앞뒤가 같은 짝을 고른다(vote/boat보다 vet/bet).
- 틀리면 `tips`(입·혀 모양)를 보여 준다. 짝별 맞음·틀림은 휴대폰에 저장되어 "내 발음 약점"에 모인다.

### 일본어 문장의 한자 표기 (kanji_text)

🎤 따라 말하기가 있는 일본어 문장에는 한자 섞인 표기를 함께 적는다. 음성 인식 결과가 보통 한자로 나오기 때문에, 히라가나와 한자 표기 둘 다 정답으로 인정한다.

| 파일 | 칸 |
| --- | --- |
| `ja/situations.json` 대화 줄·핵심 문장 | `kanji_text` |
| `ja/particles.json` 예문·비교 예문 | `kanji_text` |
| `ja/words.json` 카드 예문 | `example_kanji_text` |
| `ja/verbs.json` 동사 예문 | `example.kanji_text` |

예: `"text": "くうこうへは どう いけば いいですか。", "kanji_text": "空港へはどう行けばいいですか。"`
- 일본어에서 보통 쓰는 표기로, 띄어쓰기 없이 쓴다. 아이들이 가나로 쓰는 말(かわいい, りんご)은 가나 그대로.
- 숫자는 음성 인식이 돌려주는 모양(1200円, 6時, 20本)으로 쓴다.
- `validate.py`가 `kanji_text`의 가나 부분(に, きます 같은 조사·어미)이 히라가나 문장에 같은 순서로 있는지 검사한다.

### 일본어 조사 (ja/particles.json)

```json
{
  "stages": [ { "id": "s2", "name": "2단계", "desc": "자리와 방향: を·に·で·へ" } ],
  "particles": [
    { "id": "ni", "stage": "s2", "text": "に", "ko_pron": "니", "meaning": "~에", "role": "어디로 가는지, …",
      "uses": [
        { "name": "가는 곳", "desc": "어디에 가는지", "examples": [
          { "text": "こうえん[に] いく。", "ko_pron": "코-엔니 이쿠.", "meaning": "공원에 가.", "words": ["こうえん"] } ] }
      ] }
  ],
  "compare": [
    { "id": "ni-de", "pair": ["ni", "de"], "title": "に와 で", "points": { "ni": "가는 곳, 있는 곳", "de": "…" },
      "examples": [ { "particle": "ni", "text": "こうえん[に] いく。", "ko_pron": "…", "meaning": "…", "why": "가는 곳이라 に", "words": ["こうえん"] } ],
      "quiz": [ { "text": "がっこう[___] いく。", "choices": ["に", "で"], "answers": ["に"],
                  "ko_pron": "갓코-니 이쿠.", "meaning": "학교에 가.", "why": "가는 곳이라 に", "words": ["がっこう"] } ] }
  ]
}
```

- `uses`는 쓰임별 묶음이다. 화면에서 쓰임 이름이 소제목이 되고 그 아래 예문이 모인다.
  쓰임이 하나면 예문 3~4개, 여러 개면(に·で·と) 쓰임마다 2~3개.
- 예문의 조사는 `[ ]`로 표시한다. 화면에서는 강조로 바뀌고, 발음 듣기와 가나 검사는 괄호를 뺀 문장으로 한다.
- `words`에는 예문에 쓴 `ja/words.json` 단어를 적는다. 검사기가 단어가 있는지, 예문에 들어 있는지 확인한다.
- 퀴즈는 빈칸을 `[___]`로 쓰고, 정답이 여럿이면 `answers`에 모두 넣는다(예: に·へ 둘 다 맞음). `ko_pron`·`meaning`은 첫 정답을 넣은 문장 기준. 퀴즈 화면은 아직 없다.

### 패턴 영어 (patterns.json)

```json
{
  "group": "바람·취향",
  "pattern": "I want to ___",
  "ko_pron": "아이 원 투 ___",
  "meaning": "~하고 싶어",
  "tip": "to 뒤에는 동사가 와요.",
  "fills": [ { "text": "eat", "ko_pron": "잇", "meaning": "먹고 싶어" } ]
}
```

`___` 자리에 `fills`의 말이 들어가 문장이 된다. `fills.meaning`은 완성된 문장의 뜻을 쓴다.
틀마다 `fills`는 12개. 동작·장소·사람·물건·시간, 짧은 말과 긴 말이 섞이게 고른다.

단어별 뜻(화면에서 단어를 누르면 뜸)은 `words`에 적는다. 규칙은 CLAUDE.md "패턴 단어별 뜻" 참고.

```json
{ "pattern": "I want to ___", "words": { "i": { "ko_pron": "아이", "meaning": "나" }, "to": { "ko_pron": "투", "meaning": "~하기를 (want to = ~하고 싶다)" }, "the": { … } },
  "fills": [ { "text": "go to the park", "ko_pron": "고 투 더 파크", "meaning": "공원에 가고 싶어",
               "words": { "to": { "ko_pron": "투", "meaning": "~로, ~에" }, "park": { "ko_pron": "파크", "meaning": "공원" } } } ] }
```

### 비슷한 패턴 비교 (pattern_compare.json)

```json
{ "compare": [
  { "id": "need-have", "pair": ["I need to ___", "I have to ___"], "title": "I need to와 I have to",
    "points": ["내가 필요해서 해야 할 때", "규칙·약속 때문에 꼭 해야 할 때"],
    "examples": [ { "side": 1, "text": "[I have to] go to school.", "ko_pron": "아이 해브 투 고 투 스쿨",
                    "meaning": "학교에 가야 해.", "why": "학교는 정해진 규칙" } ],
    "quiz": [ { "context": "도서관 규칙을 말할 때", "text": "[___] be quiet in the library.",
                "choices": ["I need to", "I have to"], "answers": ["I have to"], "ko_pron": "…", "meaning": "…", "why": "…" } ] } ] }
```

- `pair`는 `patterns.json`에 있는 틀이어야 한다(화면의 "이 패턴 연습하기"가 그 틀로 간다).
- 예문은 `[틀 앞부분]`을 괄호로 표시한다(`side` 0·1). 화면은 조사 비교와 같은 화면(`renderCompare`)을 쓴다.
- 퀴즈는 `context`(상황)가 있어야 정답이 갈린다. 둘 다 맞으면 `answers`에 둘 다 넣는다. 퀴즈 화면은 아직 없다.

### 상황별 회화 (situations.json)

```json
{
  "scene": "식당", "emoji": "🍽️", "desc": "자리 잡기, 주문, 계산",
  "dialogues": [
    { "title": "주문하기", "lines": [
      { "who": "직원", "text": "How many?", "ko_pron": "하우 메니?", "meaning": "몇 분이세요?" },
      { "who": "나",   "text": "Two, please.", "ko_pron": "투, 플리즈", "meaning": "두 명이요." }
    ] }
  ],
  "phrases": [ { "text": "No ice, please.", "ko_pron": "노 아이스, 플리즈", "meaning": "얼음 빼 주세요." } ]
}
```

`who`가 `"나"`인 줄은 오른쪽 말풍선으로 보인다.

### 일본어 동사 변형 (ja/verbs.json)

영어 `verbs.json`(카드 목록)과 모양이 다르다. 표의 줄은 `groups`, 칸은 `forms` 순서대로 그려진다.

```json
{
  "groups": [ { "id": "g1", "name": "1형 (5단 동사)", "desc": "끝이 う·く·す… 로 끝나는 동사" } ],
  "forms":  [ { "id": "te", "name": "て형", "desc": "~하고, ~해서, ~해 줘" } ],
  "verbs": [
    { "id": "iku", "group": "g1", "text": "いく", "kanji": "行く", "ko_pron": "이쿠", "meaning": "가다",
      "note": "예외: て형은 いって",
      "forms": { "te": { "text": "いって", "ko_pron": "잇테", "meaning": "가고 / 가서" } },
      "example": { "text": "がっこうに いきます。", "ko_pron": "각코니 이키마스.", "meaning": "학교에 가요." } }
  ]
}
```

- `text`(동사·활용형)는 히라가나만 쓴다. 예문에는 가타카나도 된다.
- `kanji`는 히라가나 아래에 작게 보인다. 한자로 쓰지 않는 동사(する)는 `null`.
- `forms`에는 `forms` 목록의 모든 활용형이 있어야 한다. `note`는 없어도 된다.

## 새 섹션 여는 법 (예: 일본어 기초 단어)

1. `data/ja/words.json`을 위 형식으로 만든다 (`text`에 히라가나, `ko_pron`에 한글 발음).
2. `js/core.js`의 `LANGS.ja.sections`에서 해당 섹션의 `ready`를 `true`로 바꾼다.
3. `python tools/validate.py`로 검사한다.

## 미리보기 한 파일 만들기

```
python tools/build_preview.py
```

`dist/preview.html` 하나에 모든 코드와 데이터가 들어간다. 서버 없이 열리고, 휴대폰으로 보내 확인하기 좋다.

## 현재 담긴 양

| 섹션 | 양 |
| --- | --- |
| 영어 기초 단어 | 36개 주제, 370개 |
| 영어 동사 | 5개 주제, 42개 |
| 패턴 영어 | 33개 틀, 문장 396개 (틀마다 12개) |
| 비슷한 패턴 비교 | 5개 짝, 예문 20개, 퀴즈 15개 |
| 발음 연습 (영어) | 5개 짝, 26쌍 |
| 발음 연습 (일본어) | 4개 짝, 19쌍 |
| 상황별 회화 | 12개 장면, 대화 24개(134줄), 핵심 문장 72개 |
| 일본어 기초 단어 | 19개 주제, 177개 (영어 주제 순서의 1~19번) |
| 일본어 동사 변형 | 동사 15개 (1형 10·2형 3·3형 2) × 활용형 5개 |
| 일본어 조사 | 조사 9개, 예문 38개, 비교 3개(예문 12개, 퀴즈 9개) |
| 일본어 상황별 회화 | 12개 장면, 대화 24개(134줄), 핵심 문장 72개 |
