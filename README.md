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
  js/views.js           화면 그리기 (카드, 패턴, 상황별 회화)
  js/app.js             주소(#)에 따라 화면 고르기
  data/en/              영어 데이터
    words.json          기초 단어 (주제별)
    verbs.json          동사 (주제별)
    patterns.json       패턴 영어
    situations.json     상황별 회화
  data/ja/              일본어 데이터
    words.json          기초 단어 (주제별, kanji·예문 발음 포함)
    verbs.json          동사 변형 (1·2·3형 × 활용형 표)
    situations.json     상황별 회화 (영어와 같은 형식)
  tools/validate.py     데이터 검사
  tools/build_preview.py 한 파일 미리보기 만들기 → dist/preview.html
```

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
| 영어 기초 단어 | 28개 주제, 275개 |
| 영어 동사 | 5개 주제, 42개 |
| 패턴 영어 | 15개 틀, 문장 90개 |
| 상황별 회화 | 6개 장면, 대화 12개(65줄), 핵심 문장 36개 |
| 일본어 기초 단어 | 19개 주제, 177개 (영어 주제 순서의 1~19번) |
| 일본어 동사 변형 | 동사 15개 (1형 10·2형 3·3형 2) × 활용형 5개 |
| 일본어 상황별 회화 | 6개 장면, 대화 12개(65줄), 핵심 문장 36개 |
