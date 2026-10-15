"""데이터 파일 검사.
단어·문장을 늘린 뒤 실행하면 빠진 칸, 중복, 형식 오류를 알려준다.

실행: python tools/validate.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASIC = ["text", "ko_pron", "meaning"]
HIRAGANA = re.compile(r"^[ぁ-ゟ]+$")
# 히라가나·가타카나(ー 포함). 긴 표현은 단어 사이 한 칸 띄어쓰기 허용 (ありがとう ございます)
# 맞장구·반응 카드(ほんとう？, すごい！)를 위해 끝에 ？·！ 하나는 허용
KANA = re.compile(r"^[ぁ-ゟ゠-ヿ]+( [ぁ-ゟ゠-ヿ]+)*[？！]?$")
KANA_SENTENCE = re.compile(r"^[ぁ-ゟ゠-ヿ 、。？！]+$")
KANJI = re.compile(r"[一-鿿]")
problems = []
warnings = []   # 멈추지 않고 사람이 확인할 것

# 카드 큰 글자에서 띄어쓰기 없는 덩어리의 경고 기준.
# 360px 화면(카드 안쪽 폭 약 288px)에서 가장 긴 7글자 おねがいします는 39.8px로 한 줄에 들어간다.
# 7글자 × 39.8px ≈ 279px이므로 같은 폭에 8글자를 넣으면 279 ÷ 8 ≈ 34.8px이 되어
# 최소 크기 36px(views.js WORD_MIN)보다 작아진다. 그래서 8글자부터 경고한다.
LONG_CHUNK = 8

def warn_long_chunk(text, where):
    """일본어 큰 글자 text에 띄어쓰기 없이 LONG_CHUNK글자 이상인 덩어리가 있으면 경고."""
    for chunk in str(text).split(" "):
        if len(chunk) >= LONG_CHUNK:
            warnings.append(f"{where}: 띄어쓰기 없는 {len(chunk)}글자 '{chunk}' — 띄어 쓸 수 있는 말인지 확인해 주세요")

KANA_RUN = re.compile(r"[ぁ-ゟ゠-ヿ]+")

def check_kanji_text(hira, kanji, where, field="kanji_text"):
    """한자 섞인 표기가 비지 않았는지, 그 가나 부분(조사·어미)이 히라가나 문장에 같은 순서로 들어 있는지.
    예: 'くうこうに いきます' ↔ '空港に行きます' 의 に, きます 가 순서대로 있어야 한다. 띄어쓰기·문장부호·[ ]는 무시."""
    if not str(kanji or "").strip():
        problems.append(f"{where}: '{field}'(한자 섞인 표기)가 비어 있어요")
        return
    squash = lambda t: re.sub(r"[\s、。？！?!,.\[\]]", "", str(t))
    h, pos = squash(hira), 0
    for run in KANA_RUN.findall(squash(kanji)):
        i = h.find(run, pos)
        if i < 0:
            problems.append(f"{where}: {field}의 가나 '{run}'가 히라가나 문장에 (같은 순서로) 없어요 — '{kanji}'")
            return
        pos = i + len(run)

def need(obj, keys, where):
    for k in keys:
        if not str(obj.get(k, "")).strip():
            problems.append(f"{where}: '{k}' 칸이 비어 있어요")

# ── 빈도 등급 freq: 3=매일 쓰는 말, 2=자주, 1=가끔 ──
# 기준: 영어는 Dolch 단어 목록, 일본어는 JLPT N5 단어를 참고하고 일상 회화 빈도로 판단 (README "빈도 등급")
FREQS = (1, 2, 3)

def check_freq(obj, where, key="freq", upto=None, upto_name=""):
    """freq가 1·2·3인지. upto가 있으면 그보다 높을 수 없다 (틀을 매일 안 쓰는데 그 틀 문장을 매일 쓸 수는 없다)."""
    v = obj.get(key)
    if v not in FREQS:
        problems.append(f"{where}: '{key}'(빈도 등급 1·2·3)가 없거나 잘못됐어요 — {v!r}")
    elif upto in FREQS and v > upto:
        problems.append(f"{where}: {key} {v}가 {upto_name} 등급 {upto}보다 높아요")

def dolch_words():
    """tools/dolch.txt(한 줄에 한 단어, #은 설명)가 있을 때만 Dolch 비교를 한다. 없으면 조용히 건너뛴다."""
    path = ROOT / "tools/dolch.txt"
    if not path.exists():
        return set()
    try:
        return {w.strip().lower() for w in path.read_text(encoding="utf-8").splitlines()
                if w.strip() and not w.strip().startswith("#")}
    except Exception:
        return set()
DOLCH = dolch_words()

def warn_dolch(text, freq, where):
    """Dolch 목록(아이 글에 가장 많이 나오는 말)에 있는데 1등급이면 경고."""
    if freq == 1 and str(text).lower() in DOLCH:
        warnings.append(f"{where}: Dolch 단어인데 1등급이에요 — 2 이상인지 확인해 주세요")

def check_cards(data, name):
    for c in data:
        need(c, ["category"], f"{name} 주제")
        seen = set()
        for i, it in enumerate(c.get("items", [])):
            where = f"{name} > {c.get('category')} > {i + 1}번 ({it.get('text', '?')})"
            need(it, BASIC, where)
            check_freq(it, where)
            if name.startswith("en/"):
                warn_dolch(it.get("text"), it.get("freq"), where)
            if it.get("example") and not it.get("example_meaning"):
                problems.append(f"{where}: 예문 뜻(example_meaning)이 없어요")
            if "note" in it and not str(it["note"] or "").strip():
                problems.append(f"{where}: note 칸이 비어 있어요 (필요 없으면 칸을 지워요)")
            key = it.get("text", "").lower()
            if key in seen:
                problems.append(f"{where}: 같은 주제 안에 중복된 단어예요")
            seen.add(key)

def check_ja_cards(data, name):
    """일본어 카드: 카드 검사 + kanji 칸, 가나 여부, 예문 발음."""
    check_cards(data, name)
    for c in data:
        for i, it in enumerate(c.get("items", [])):
            where = f"{name} > {c.get('category')} > {i + 1}번 ({it.get('text', '?')})"
            if "kanji" not in it:
                problems.append(f"{where}: 'kanji' 칸이 없어요 (한자로 안 쓰면 null)")
            elif it["kanji"] is not None and not KANJI.search(str(it["kanji"])):
                problems.append(f"{where}: kanji에 한자가 없어요 (한자로 안 쓰면 null)")
            if it.get("text") and not KANA.match(it["text"]):
                problems.append(f"{where}: text는 히라가나·가타카나로만 써요")
            warn_long_chunk(it.get("text", ""), where)
            if it.get("example"):
                if not KANA_SENTENCE.match(it["example"]):
                    problems.append(f"{where}: 예문은 가나로만 써요")
                check_kanji_text(it["example"], it.get("example_kanji_text"), f"{where} > 예문", "example_kanji_text")
                if not str(it.get("example_ko_pron", "")).strip():
                    problems.append(f"{where}: 예문 발음(example_ko_pron)이 없어요")
                # 예문도 학습 길의 문장으로 쓴다. 예문은 그 단어보다 자주 쓸 수 없다
                check_freq(it, f"{where} > 예문", "example_freq", it.get("freq"), "단어")

def ja_word_texts():
    try:
        words = json.loads((ROOT / "data/ja/words.json").read_text(encoding="utf-8"))
        return {it["text"] for c in words for it in c.get("items", [])}
    except Exception:
        return set()

def check_particles(data, name):
    """일본어 조사: 쓰임(uses)별 예문, [조사] 표시, 예문 단어(words)가 words.json에 있는지, 비교·퀴즈."""
    known = ja_word_texts()
    plain = lambda t: str(t).replace("[", "").replace("]", "")
    def sentence(ex, where, mark, kanji=True):
        need(ex, BASIC, where)
        t = ex.get("text", "")
        if kanji:
            check_kanji_text(t, ex.get("kanji_text"), where)
        if mark not in t:
            problems.append(f"{where}: 예문에 {mark} 표시가 없어요")
        if t and not KANA_SENTENCE.match(plain(t)):
            problems.append(f"{where}: 예문은 가나로만 써요 (괄호를 뺀 문장 기준)")
        ws = ex.get("words")
        if not ws:
            problems.append(f"{where}: 예문에 쓴 words.json 단어(words)가 없어요")
        for w in ws or []:
            if w not in known:
                problems.append(f"{where}: '{w}'는 words.json에 없는 단어예요")
            elif w not in plain(t):
                problems.append(f"{where}: '{w}'가 예문에 안 들어 있어요")
    stages = {s.get("id") for s in data.get("stages", [])}
    pts = {}
    for i, p in enumerate(data.get("particles", [])):
        where = f"{name} > {i + 1}번 ({p.get('text', '?')})"
        need(p, ["id", "role"] + BASIC, where)
        if p.get("id") in pts:
            problems.append(f"{where}: 중복된 id예요")
        pts[p.get("id")] = p.get("text")
        if p.get("stage") not in stages:
            problems.append(f"{where}: stage '{p.get('stage')}'이 stages에 없어요")
        check_freq(p, where)
        uses = p.get("uses") or []
        if not uses:
            problems.append(f"{where}: 쓰임(uses)이 없어요")
        for u in uses:
            n = len(u.get("examples", []))
            if not str(u.get("name", "")).strip():
                problems.append(f"{where}: 쓰임 이름(name)이 없어요")
            lo, hi = (3, 4) if len(uses) == 1 else (2, 3)
            if not lo <= n <= hi:
                problems.append(f"{where} > {u.get('name')}: 예문이 {n}개예요 ({lo}~{hi}개)")
            for k, ex in enumerate(u.get("examples", [])):
                sentence(ex, f"{where} > {u.get('name')} {k + 1}번", f"[{p.get('text')}]")
                # 쓰임별 예문은 학습 길의 문장으로 쓴다 (조사 등급을 넘지 않게)
                check_freq(ex, f"{where} > {u.get('name')} {k + 1}번", upto=p.get("freq"), upto_name="조사")
    for i, c in enumerate(data.get("compare", [])):
        where = f"{name} > 비교 {i + 1}번 ({c.get('title', '?')})"
        pair = c.get("pair", [])
        if len(pair) != 2 or any(x not in pts for x in pair):
            problems.append(f"{where}: pair가 조사 id 두 개가 아니에요")
            continue
        for x in pair:
            if not str(c.get("points", {}).get(x, "")).strip():
                problems.append(f"{where}: points에 '{x}' 설명이 없어요")
        for k, ex in enumerate(c.get("examples", [])):
            w = f"{where} > 예문 {k + 1}번"
            if ex.get("particle") not in pair:
                problems.append(f"{w}: particle이 pair에 없어요")
                continue
            need(ex, ["why"], w)
            sentence(ex, w, f"[{pts[ex['particle']]}]")
        for k, q in enumerate(c.get("quiz", [])):
            w = f"{where} > 퀴즈 {k + 1}번"
            ans = check_quiz(q, [pts[x] for x in pair], w, ja=True)
            filled = dict(q, text=q.get("text", "").replace("[___]", f"[{ans[0]}]" if ans else ""))
            sentence(filled, w, f"[{ans[0]}]" if ans else "[?]", kanji=False)   # 한자 표기는 check_quiz가 검사

def check_quiz(q, choices, where, ja=False):
    """퀴즈 한 문제 (일본어 조사·패턴 비교·작은 말이 같은 형식):
    { context?, text: '…[___]…', choices, answers, ko_pron, meaning, why, words?, kanji_text(일본어, [___] 포함) }
    choices는 비교하는 쪽의 이름 그대로(순서 무관). ko_pron·meaning은 정답을 넣은 문장. 정답 목록을 돌려준다."""
    need(q, BASIC + ["why"], where)
    if "context" in q and not str(q["context"]).strip():
        problems.append(f"{where}: context가 비어 있어요 (없으면 칸을 빼요)")
    if q.get("text", "").count("[___]") != 1:
        problems.append(f"{where}: 빈칸 [___]이 하나여야 해요")
    if sorted(q.get("choices", [])) != sorted(choices):
        problems.append(f"{where}: choices가 비교하는 {' / '.join(choices)}가 아니에요")
    ans = q.get("answers") or []
    if not ans or any(a not in q.get("choices", []) for a in ans):
        problems.append(f"{where}: answers가 choices 안에 없어요")
    if ja:
        kt = str(q.get("kanji_text") or "")
        if kt.count("[___]") != 1:
            problems.append(f"{where}: kanji_text에도 빈칸 [___]이 하나 있어야 해요")
        elif ans:
            check_kanji_text(q.get("text", "").replace("[___]", ans[0]), kt.replace("[___]", ans[0]), where)
    return ans

def pattern_prefix(pattern):
    """'Can I ___?' → 'Can I' : 비교 예문의 [ ] 안에 들어가는 틀 앞부분."""
    return pattern.replace("___", "").replace("?", "").strip()

def check_pattern_compare(data, name):
    """비슷한 패턴 비교: pair가 patterns.json에 있는 틀인지, 예문의 [틀], 퀴즈 보기·정답·상황."""
    try:
        known = {p["pattern"] for p in json.loads((ROOT / "data/en/patterns.json").read_text(encoding="utf-8"))}
    except Exception:
        known = set()
    ids = set()
    for i, c in enumerate(data.get("compare", [])):
        where = f"{name} > {i + 1}번 ({c.get('title', '?')})"
        need(c, ["id", "title"], where)
        if c.get("id") in ids:
            problems.append(f"{where}: 중복된 id예요")
        ids.add(c.get("id"))
        pair = c.get("pair", [])
        if len(pair) != 2:
            problems.append(f"{where}: pair는 틀 두 개여야 해요")
            continue
        for x in pair:
            if x not in known:
                problems.append(f"{where}: '{x}'가 patterns.json에 없어요 (연습하기 링크가 끊겨요)")
        pts = c.get("points", [])
        if len(pts) != 2 or not all(str(x).strip() for x in pts):
            problems.append(f"{where}: points(언제 쓰는지)가 두 개여야 해요")
        prefixes = [pattern_prefix(x) for x in pair]
        sides = set()
        for k, ex in enumerate(c.get("examples", [])):
            w = f"{where} > 예문 {k + 1}번"
            need(ex, BASIC + ["why"], w)
            if ex.get("side") not in (0, 1):
                problems.append(f"{w}: side는 0 또는 1이에요")
                continue
            sides.add(ex["side"])
            if f"[{prefixes[ex['side']]}]" not in ex.get("text", ""):
                problems.append(f"{w}: 예문에 [{prefixes[ex['side']]}] 표시가 없어요")
        if sides != {0, 1}:
            problems.append(f"{where}: 두 틀 모두 예문이 있어야 해요")
        for k, q in enumerate(c.get("quiz", [])):
            w = f"{where} > 퀴즈 {k + 1}번"
            check_quiz(q, prefixes, w)
            need(q, ["context"], w)   # 두 틀 모두 문법상 맞을 때가 많아 상황이 있어야 정답이 갈린다

def check_pairs(data, name):
    """헷갈리는 짝: 소리 두 개와 입 모양 팁, 짝 4~6쌍, 두 단어가 서로 다른지, 일본어는 가나·kanji 칸."""
    ja = name.startswith("ja/")
    ids = set()
    for i, s in enumerate(data.get("sets", [])):
        where = f"{name} > {i + 1}번 ({s.get('name', '?')})"
        need(s, ["id", "name"], where)
        if s.get("id") in ids:
            problems.append(f"{where}: 중복된 id예요")
        ids.add(s.get("id"))
        sounds = s.get("sounds", [])
        if len(sounds) != 2:
            problems.append(f"{where}: sounds는 두 개여야 해요")
        for snd in sounds:
            if not str((s.get("tips") or {}).get(snd, "")).strip():
                problems.append(f"{where}: '{snd}' 입 모양 팁(tips)이 없어요")
        pairs = s.get("pairs", [])
        if not 4 <= len(pairs) <= 6:
            problems.append(f"{where}: 짝이 {len(pairs)}쌍이에요 (4~6쌍)")
        for k, pr in enumerate(pairs):
            w = f"{where} > {k + 1}번 짝"
            for side in ("a", "b"):
                x = pr.get(side) or {}
                need(x, BASIC, f"{w} {side}")
                if ja:
                    if "kanji" not in x:
                        problems.append(f"{w} {side}: 'kanji' 칸이 없어요 (한자로 안 쓰면 null)")
                    if x.get("text") and not KANA.match(x["text"]):
                        problems.append(f"{w} {side}: text는 가나로만 써요")
            if (pr.get("a") or {}).get("text") == (pr.get("b") or {}).get("text"):
                problems.append(f"{w}: 두 단어가 같아요")

def tip_ids(lang):
    """data/<언어>/tips.json의 설명 id 목록 (파일이 없으면 빈 집합)."""
    try:
        return {t.get("id") for t in json.loads((ROOT / f"data/{lang}/tips.json").read_text(encoding="utf-8"))["tips"]}
    except Exception:
        return set()

def check_patterns(data, name):
    known_tips = tip_ids(name.split("/")[0])
    for i, p in enumerate(data):
        where = f"{name} > {i + 1}번 ({p.get('pattern', '?')})"
        need(p, ["group", "pattern", "ko_pron", "meaning"], where)
        check_freq(p, where)
        for j, f in enumerate(p.get("fills", [])):
            check_freq(f, f"{where} > 바꿔 넣을 말 {j + 1}번 ({f.get('text', '?')})", upto=p.get("freq"), upto_name="틀")
        ids = p.get("tip_ids", [])
        if not isinstance(ids, list):
            problems.append(f"{where}: tip_ids는 [ ] 목록이어야 해요")
            ids = []
        for t in ids:
            if t not in known_tips:
                problems.append(f"{where}: tip_ids의 '{t}'가 tips.json에 없어요 (💡 설명이 안 보여요)")
        if len(ids) != len(set(ids)):
            problems.append(f"{where}: tip_ids에 같은 id가 두 번 있어요")
        if "___" not in p.get("pattern", ""):
            problems.append(f"{where}: pattern에 빈칸 ___ 이 없어요")
        if "___" not in p.get("ko_pron", ""):
            problems.append(f"{where}: ko_pron에 빈칸 ___ 이 없어요")
        fills = p.get("fills", [])
        check_word_glosses(p, where)
        if len(fills) not in FILL_COUNTS:
            problems.append(f"{where}: 바꿔 넣을 말이 {len(fills)}개예요 ({' 또는 '.join(map(str, FILL_COUNTS))}개)")
        seen = set()
        for j, f in enumerate(fills):
            need(f, BASIC, f"{where} > 바꿔 넣을 말 {j + 1}번")
            key = f.get("text", "").lower()
            if key in seen:
                problems.append(f"{where} > 바꿔 넣을 말 {j + 1}번: '{f.get('text')}'가 겹쳐요")
            seen.add(key)
            if p.get("pattern", "").endswith("?") != f.get("meaning", "").endswith("?"):
                problems.append(f"{where} > 바꿔 넣을 말 {j + 1}번: 묻는 틀이면 뜻도 ?로 끝나요")

WORD = re.compile(r"[A-Za-z0-9][A-Za-z0-9'\-]*")

def check_word_glosses(p, where):
    """문장(틀 + 바꿔 넣는 말)의 모든 단어에 뜻이 있는지.
    틀 자리 단어는 pattern.words, 바꿔 넣는 말 자리 단어는 fill.words → 없으면 pattern.words(기본값)."""
    pattern = p.get("pattern", "")
    pw = {k.lower(): v for k, v in (p.get("words") or {}).items()}
    if "___" not in pattern:
        return
    start = pattern.index("___")
    frame_words = {m.group().lower() for m in WORD.finditer(pattern.replace("___", " "))}
    for j, f in enumerate(p.get("fills", [])):
        fw = {k.lower(): v for k, v in (f.get("words") or {}).items()}
        text = f.get("text", "")
        end = start + len(text)
        for m in WORD.finditer(pattern.replace("___", text)):
            tok = m.group().lower()
            in_fill = m.start() < end and m.end() > start
            if in_fill and tok in frame_words and tok not in fw:
                warnings.append(f"{where} > 바꿔 넣을 말 {j + 1}번 ({text}): '{m.group()}'가 틀 단어와 같은데 말 쪽 뜻이 없어서 "
                                f"틀의 뜻이 쓰여요 — 같은 뜻인지 확인해 주세요")
            g = (fw.get(tok) or pw.get(tok)) if in_fill else pw.get(tok)
            if not g:
                problems.append(f"{where} > 바꿔 넣을 말 {j + 1}번 ({text}): '{m.group()}' 뜻이 없어요"
                                + ("" if in_fill else " (틀 단어는 패턴 words에)"))
            elif not str(g.get("meaning", "")).strip() or not str(g.get("ko_pron", "")).strip():
                problems.append(f"{where} > 바꿔 넣을 말 {j + 1}번 ({text}): '{m.group()}'의 ko_pron·meaning이 비어 있어요")

# 패턴마다 바꿔 넣을 말 개수
FILL_COUNTS = (12,)

TIP_BODY = (3, 5)       # 설명 줄 수 ({lang, text} 조각 줄, check_chunks)

def function_words_ids():
    """작은 말 항목·비교 id (알아두기의 see 연결 검사용)."""
    try:
        d = json.loads((ROOT / "data/en/function_words.json").read_text(encoding="utf-8"))
        return {"items": {x.get("id") for x in d.get("items", [])}, "compare": {x.get("id") for x in d.get("compare", [])}}
    except Exception:
        return {"items": set(), "compare": set()}
TIP_EXAMPLES = (2, 5)   # 예문 개수

def check_tips(data, name):
    """💡 알아두기: 설명 줄 수·예문 개수, 예문의 ko_pron·meaning, [강조] 괄호, 예문의 모든 단어 뜻,
    어느 패턴에서도 가리키지 않는 설명(경고).
    단어 뜻 찾는 순서는 views.js bindTips와 같다: 예문 words의 '단어@몇번째' → 예문 words → 설명 words."""
    lang = name.split("/")[0]
    try:
        used = {t for p in json.loads((ROOT / f"data/{lang}/patterns.json").read_text(encoding="utf-8"))
                for t in (p.get("tip_ids") or [])}
        if (ROOT / f"data/{lang}/lessons.json").exists():         # 레슨 핵심 재료로 쓰는 설명도 쓰이는 것
            used |= {c["ref"][4:] for u in json.loads((ROOT / f"data/{lang}/lessons.json").read_text(encoding="utf-8")).get("units", [])
                     for l in u.get("lessons", []) for c in l.get("core", []) if str(c.get("ref", "")).startswith("tip:")}
    except Exception:
        used = set()
    ids = set()
    for i, t in enumerate(data.get("tips", [])):
        where = f"{name} > {i + 1}번 ({t.get('title', '?')})"
        need(t, ["id", "title"], where)
        if t.get("id") in ids:
            problems.append(f"{where}: 중복된 id예요")
        ids.add(t.get("id"))
        if t.get("id") not in used:
            warnings.append(f"{where}: 이 설명을 가리키는 패턴(tip_ids)이 없어요 — 모음에서만 보여요")
        if "see" in t:
            # 작은 말 하나에 대한 설명은 tips에 쓰지 않고 작은 말 화면을 가리킨다
            see = t["see"] if isinstance(t["see"], dict) else {}
            fw = function_words_ids()
            if set(see) not in ({"item"}, {"compare"}):
                problems.append(f"{where}: see는 {{\"item\": 작은 말 id}} 또는 {{\"compare\": 비교 id}} 하나예요")
            elif see.get("item") is not None and see["item"] not in fw["items"]:
                problems.append(f"{where}: see의 '{see['item']}'가 작은 말(items)에 없어요")
            elif see.get("compare") is not None and see["compare"] not in fw["compare"]:
                problems.append(f"{where}: see의 '{see['compare']}'가 작은 말 비교(compare)에 없어요")
            if "body" in t or "examples" in t:
                problems.append(f"{where}: see(연결) 설명에는 body·examples를 쓰지 않아요 — 설명은 작은 말 쪽에")
            continue
        check_chunks(t.get("body"), f"{where} > body", TIP_BODY)
        tw = {k.lower(): v for k, v in (t.get("words") or {}).items()}
        exs = t.get("examples", [])
        if not TIP_EXAMPLES[0] <= len(exs) <= TIP_EXAMPLES[1]:
            problems.append(f"{where}: 예문이 {len(exs)}개예요 ({TIP_EXAMPLES[0]}~{TIP_EXAMPLES[1]}개)")
        for k, ex in enumerate(exs):
            w = f"{where} > 예문 {k + 1}번 ({ex.get('text', '?')})"
            need(ex, BASIC, w)
            spoken_meaning(ex, w)
            text = ex.get("text", "")
            if not re.fullmatch(r"[^\[\]]*(\[[^\[\]]+\][^\[\]]*)+", text):
                problems.append(f"{w}: 강조할 부분을 [ ]로 한 번 이상 감싸야 해요 (괄호 짝도 맞게)")
            ew = {k2.lower(): v for k2, v in (ex.get("words") or {}).items()}
            seen = {}
            for m in WORD.finditer(text.replace("[", "").replace("]", "")):
                tok = m.group().lower()
                seen[tok] = seen.get(tok, 0) + 1
                g = ew.get(f"{tok}@{seen[tok]}") or ew.get(tok) or tw.get(tok)
                if not g:
                    problems.append(f"{w}: '{m.group()}' 뜻이 없어요 (예문 words나 설명 words에)")
                elif not str(g.get("meaning", "")).strip() or not str(g.get("ko_pron", "")).strip():
                    problems.append(f"{w}: '{m.group()}'의 ko_pron·meaning이 비어 있어요")

HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")
LATIN = re.compile(r"[A-Za-z]")
CHUNK_LANGS = ("ko", "en", "ja")

def check_chunks(lines, where, count=None):
    """설명 줄 = {lang, text} 조각 목록. 🔊가 조각마다 그 언어 목소리로 읽는다.
    영어·일본어 조각에 한글, 한국어 조각에 알파벳이 있으면 다른 언어 목소리가 읽게 되어 문제로 본다."""
    if not isinstance(lines, list) or not lines:
        problems.append(f"{where}: 설명 줄이 없어요")
        return
    if count and not count[0] <= len(lines) <= count[1]:
        problems.append(f"{where}: 설명이 {len(lines)}줄이에요 ({count[0]}~{count[1]}줄)")
    for i, ln in enumerate(lines):
        w = f"{where} {i + 1}번째 줄"
        if not isinstance(ln, list) or not ln:
            problems.append(f"{w}: [{{lang, text}}, …] 조각 목록이어야 해요")
            continue
        for c in ln:
            if not isinstance(c, dict) or c.get("lang") not in CHUNK_LANGS:
                problems.append(f"{w}: 조각의 lang은 {'/'.join(CHUNK_LANGS)} 중 하나예요 — {c}")
                continue
            t = str(c.get("text", ""))
            if not t.strip():
                problems.append(f"{w}: 빈 조각이 있어요")
            elif c.get("silent"):
                continue                                   # 화면에만 보이고 읽지 않는 조각(기호 등)
            elif c["lang"] != "ko" and HANGUL.search(t):
                problems.append(f"{w}: {c['lang']} 조각에 한글이 섞여 있어요 — '{t}'")
            elif c["lang"] == "ko" and LATIN.search(t):
                problems.append(f"{w}: 한국어 조각에 알파벳이 있어요 (한국어 목소리가 읽어요) — '{t}' → {{\"lang\": \"en\"}} 조각으로 나눠요")

def spoken_meaning(ex, where):
    """🔊 설명 듣기가 예문 뜻(meaning)을 한국어 목소리로 읽으므로 알파벳이 있으면 안 된다."""
    if LATIN.search(str(ex.get("meaning", ""))):
        problems.append(f"{where}: 뜻(meaning)에 알파벳이 있어요 (설명 듣기에서 한국어 목소리가 읽어요) — '{ex.get('meaning')}'")

def en_vocab():
    """영어 기초 단어·동사 text (소문자). 작은 말 예문의 words가 여기 있어야 한다."""
    out = set()
    for f in ("words", "verbs"):
        try:
            for c in json.loads((ROOT / f"data/en/{f}.json").read_text(encoding="utf-8")):
                out |= {it.get("text", "").lower() for it in c.get("items", [])}
        except Exception:
            pass
    return out

def check_function_words(data, name):
    """영어 작은 말: 조사와 같은 화면. 단어마다 forms(문장 속 모양), explain(조각 설명), 쓰임별 예문,
    비교는 sides({label, entry, point})로 2~3쪽, 퀴즈는 check_quiz 공통 형식."""
    vocab = en_vocab()
    stages = {s.get("id") for s in data.get("stages", [])}
    def sentence(ex, where, marks):
        need(ex, BASIC, where)
        spoken_meaning(ex, where)
        t = ex.get("text", "")
        found = [m.lower() for m in re.findall(r"\[([^\]]+)\]", t)]
        if not found:
            problems.append(f"{where}: 강조할 작은 말을 [ ]로 감싸야 해요")
        for m in found:
            if m not in marks:
                problems.append(f"{where}: [{m}]가 이 단어의 모양({', '.join(sorted(marks))})이 아니에요")
        for w in ex.get("words", []):
            if w.lower() not in vocab:
                problems.append(f"{where}: '{w}'는 기초 단어·동사에 없어요 (예문은 기초 단어 위주)")
    ids = {}
    for i, it in enumerate(data.get("items", [])):
        where = f"{name} > {i + 1}번 ({it.get('text', '?')})"
        need(it, ["id"] + BASIC, where)
        check_freq(it, where)
        for f in it.get("forms") or []:
            warn_dolch(f, it.get("freq"), where)
        if it.get("id") in ids:
            problems.append(f"{where}: 중복된 id예요")
        forms = it.get("forms") or []
        ids[it.get("id")] = set(forms)
        if it.get("stage") not in stages:
            problems.append(f"{where}: stage '{it.get('stage')}'이 stages에 없어요")
        if not forms or any(f != f.lower() or not f.strip() for f in forms):
            problems.append(f"{where}: forms(문장 속 모양, 소문자)가 없어요")
        check_chunks(it.get("explain"), f"{where} > explain", (1, 3))
        uses = it.get("uses") or []
        if not uses:
            problems.append(f"{where}: 쓰임(uses)이 없어요")
        if sum(len(u.get("examples", [])) for u in uses) < 2:
            problems.append(f"{where}: 예문이 2개 이상 있어야 해요")
        for u in uses:
            if not str(u.get("name", "")).strip():
                problems.append(f"{where}: 쓰임 이름(name)이 없어요")
            if not u.get("examples"):
                problems.append(f"{where} > {u.get('name')}: 예문이 없어요")
            for k, ex in enumerate(u.get("examples", [])):
                sentence(ex, f"{where} > {u.get('name')} {k + 1}번", set(forms))
    cids = set()
    for i, c in enumerate(data.get("compare", [])):
        where = f"{name} > 비교 {i + 1}번 ({c.get('title', '?')})"
        need(c, ["id", "title"], where)
        if c.get("id") in cids:
            problems.append(f"{where}: 중복된 id예요")
        cids.add(c.get("id"))
        sides = c.get("sides") or []
        if not 2 <= len(sides) <= 3:
            problems.append(f"{where}: sides는 2~3쪽이에요")
            continue
        for s in sides:
            need(s, ["label"], where)
            if s.get("entry") not in ids:
                problems.append(f"{where}: '{s.get('label')}'의 entry '{s.get('entry')}'가 items에 없어요")
            elif str(s.get("label", "")).lower() not in ids[s["entry"]]:
                problems.append(f"{where}: '{s.get('label')}'가 '{s.get('entry')}'의 forms에 없어요")
            check_chunks(s.get("point"), f"{where} > {s.get('label')} point", (1, 1))
        labels = [s.get("label", "") for s in sides]
        seen = set()
        for k, ex in enumerate(c.get("examples", [])):
            w = f"{where} > 예문 {k + 1}번"
            if ex.get("side") not in range(len(sides)):
                problems.append(f"{w}: side는 0~{len(sides) - 1}이에요")
                continue
            seen.add(ex["side"])
            need(ex, ["why"], w)
            sentence(ex, w, {labels[ex["side"]].lower()})
        if seen != set(range(len(sides))):
            problems.append(f"{where}: 모든 쪽에 예문이 있어야 해요")
        if not c.get("quiz"):
            problems.append(f"{where}: 퀴즈가 없어요")
        for k, q in enumerate(c.get("quiz", [])):
            w = f"{where} > 퀴즈 {k + 1}번"
            ans = check_quiz(q, labels, w)
            if ans:
                sentence(dict(q, text=q.get("text", "").replace("[___]", f"[{ans[0]}]")), w, {a.lower() for a in labels})

def fw_forms():
    """작은 말의 모양 → 항목 id 목록 (예: 'her' → ['her', 'she-her'])."""
    out = {}
    try:
        data = json.loads((ROOT / "data/en/function_words.json").read_text(encoding="utf-8"))
    except Exception:
        return out, set()
    for it in data.get("items", []):
        for f in it.get("forms", []):
            out.setdefault(f, []).append(it.get("id"))
    return out, {it.get("id") for it in data.get("items", [])}

def check_fw_link(g, tok, where, forms, ids):
    """단어 말풍선의 '더 알아보기'가 갈 곳. 말풍선 뜻(g)에 fw가 있으면 그것(false=안 붙임, 목록=버튼 여러 개),
    없으면 모양으로 찾는다. 모양이 여러 항목에 걸리면(her) 문장 속 자리에 맞는 fw를 뜻에 적어야 한다."""
    fw = g.get("fw") if isinstance(g, dict) else None
    if fw is False:
        return
    if fw is not None:
        for x in ([fw] if isinstance(fw, str) else fw if isinstance(fw, list) else [None]):
            if x not in ids:
                problems.append(f"{where}: '{tok}'의 fw '{x}'가 작은 말에 없어요")
        return
    if len(forms.get(tok, [])) > 1:
        problems.append(f"{where}: '{tok}'는 작은 말 {', '.join(forms[tok])}에 다 있어요 — 뜻에 \"fw\"로 이 자리의 항목을 적어요")
    elif tok in forms and re.match(r"^\(.*=.*\)$", str(g.get("meaning", ""))):
        warnings.append(f"{where}: '{tok}'가 '{g.get('meaning')}'처럼 묶음 말인데 더 알아보기가 붙어요 — 맞지 않으면 \"fw\": false")

def check_fw_links():
    """패턴 문장·알아두기 예문의 작은 말이 '더 알아보기'로 맞는 곳에 가는지."""
    forms, ids = fw_forms()
    if not forms:
        return
    try:
        pats = json.loads((ROOT / "data/en/patterns.json").read_text(encoding="utf-8"))
    except Exception:
        pats = []
    for p in pats:
        pattern = p.get("pattern", "")
        if "___" not in pattern:
            continue
        start = pattern.index("___")
        pw = {k.lower(): v for k, v in (p.get("words") or {}).items()}
        for f in p.get("fills", []):
            fw = {k.lower(): v for k, v in (f.get("words") or {}).items()}
            end = start + len(f.get("text", ""))
            for m in WORD.finditer(pattern.replace("___", f.get("text", ""))):
                tok = m.group().lower()
                if tok not in forms:
                    continue
                in_fill = m.start() < end and m.end() > start
                g = (fw.get(tok) or pw.get(tok)) if in_fill else pw.get(tok)
                if g:
                    check_fw_link(g, tok, f"en/patterns.json > {pattern} > {f.get('text')}", forms, ids)
    try:
        tips = json.loads((ROOT / "data/en/tips.json").read_text(encoding="utf-8")).get("tips", [])
    except Exception:
        tips = []
    for t in tips:
        tw = {k.lower(): v for k, v in (t.get("words") or {}).items()}
        for ex in t.get("examples", []):
            ew = {k.lower(): v for k, v in (ex.get("words") or {}).items()}
            seen = {}
            for m in WORD.finditer(str(ex.get("text", "")).replace("[", "").replace("]", "")):
                tok = m.group().lower()
                seen[tok] = seen.get(tok, 0) + 1
                g = ew.get(f"{tok}@{seen[tok]}") or ew.get(tok) or tw.get(tok)
                if tok in forms and g:
                    check_fw_link(g, tok, f"en/tips.json > {t.get('title')} > {ex.get('text')}", forms, ids)
    print("검사함: 작은 말 '더 알아보기' 연결")

# 영어·일본어 같은 뜻 짝: 뜻 문구가 달라 자동으로 못 찾는 단어 (일본어 text → 영어 text)
JA_EN_WORDS = {"ありがとう": "thank you", "こんにちは": "hello", "またね": "bye", "おにいちゃん": "brother", "おねえちゃん": "sister",
               "うれしい": "happy", "はらぺこ": "hungry", "つかれた": "tired", "ゆき": "snow", "でんしゃ": "train", "テーブル": "table",
               "でんわ": "phone", "なか": "in", "うえ": "on", "した": "under", "まえ": "in front of", "うしろ": "behind", "となり": "next to",
               "おかし": "snack"}

def ja_en_pairs():
    """(어디, 영어 항목, 일본어 항목) 목록.
    단어: JA_EN_WORDS → 같은 주제에서 뜻이 같은 것 → 다른 주제에서 첫 뜻이 같은 것.
    회화 핵심 문장: 같은 장면의 같은 순서 (두 언어 문장을 서로 옮긴 것이라 순서가 같다)."""
    try:
        L = lambda p: json.loads((ROOT / "data" / p).read_text(encoding="utf-8"))
        en_w, ja_w, en_s, ja_s = L("en/words.json"), L("ja/words.json"), L("en/situations.json"), L("ja/situations.json")
    except Exception:
        return []
    norm = lambda m: re.sub(r"[\s.?!,~()]", "", str(m))
    first = lambda m: norm(str(m).split(",")[0].split("(")[0])
    ens = [(c["category"], e) for c in en_w for e in c.get("items", [])]
    by_text = {e.get("text"): e for _, e in ens}
    out = []
    for c in ja_w:
        for j in c.get("items", []):
            if j.get("text") in JA_EN_WORDS and JA_EN_WORDS[j["text"]] in by_text:
                out.append((f"단어 {c['category']}", by_text[JA_EN_WORDS[j["text"]]], j)); continue
            same = [e for cat, e in ens if cat == c["category"]]
            cand = [e for e in same if norm(e.get("meaning")) == norm(j.get("meaning"))] or \
                   [e for e in same if first(e.get("meaning")) == first(j.get("meaning"))] or \
                   [e for _, e in ens if first(e.get("meaning")) == first(j.get("meaning"))]
            if cand:
                out.append((f"단어 {c['category']}", cand[0], j))
    en_by_scene = {s["scene"]: s.get("phrases", []) for s in en_s}
    for s in ja_s:
        for e, j in zip(en_by_scene.get(s["scene"], []), s.get("phrases", [])):
            out.append((f"문장 {s['scene']}", e, j))
    return out

def check_freq_pairs():
    """같은 뜻의 영어·일본어 짝의 등급이 2 이상 차이 나면 경고 (두 언어의 기준이 어긋났을 수 있다)."""
    for where, e, j in ja_en_pairs():
        if e.get("freq") in FREQS and j.get("freq") in FREQS and abs(e["freq"] - j["freq"]) >= 2:
            warnings.append(f"영어·일본어 등급 차이 ({where}): {e.get('text')} {e['freq']} / {j.get('text')} {j['freq']}")
    print("검사함: 영어·일본어 같은 짝 등급")

# ── 회화 문장 단어 뜻 ──
# 찾는 순서 (views.js glossLookup과 같다): 문장 words의 "단어@n" → 문장 words → 장면 words → 공용 glossary.json → 자동으로 찾기
# 자동으로 찾기(영어): 기초 단어(한 단어) → 동사 → 작은 말 forms → 동사의 바뀐 모양·명사 복수형(기본형의 뜻)
EN_IRREGULAR = {"go": ["went", "goes", "gone"], "have": ["has", "had"], "eat": ["ate"], "drink": ["drank"], "see": ["saw"], "say": ["said"],
    "take": ["took"], "give": ["gave"], "get": ["got"], "make": ["made"], "know": ["knew"], "think": ["thought"], "come": ["came"],
    "sleep": ["slept"], "buy": ["bought"], "do": ["does", "did"], "find": ["found"], "tell": ["told"], "feel": ["felt"], "stand": ["stood"],
    "sit": ["sat"], "wear": ["wore"], "forget": ["forgot"], "bring": ["brought"], "understand": ["understood"], "ride": ["rode"],
    "write": ["wrote"], "draw": ["drew"], "sing": ["sang"], "pay": ["paid"]}

def en_verb_forms(w):
    out = [w + "s", w + "es", w + "ing", w + "ed", w + "d", *EN_IRREGULAR.get(w, [])]
    if w.endswith("e"): out.append(w[:-1] + "ing")
    if len(w) > 1 and w.endswith("y") and w[-2] not in "aeiou": out += [w[:-1] + "ies", w[:-1] + "ied"]
    if re.search(r"[^aeiou][aeiou][pgnt]$", w): out += [w + w[-1] + "ing", w + w[-1] + "ed"]
    return out

def glossary(lang):
    try:
        return {k.lower(): v for k, v in json.loads((ROOT / f"data/{lang}/glossary.json").read_text(encoding="utf-8"))["words"].items()}
    except Exception:
        return {}

def en_auto_index():
    L = lambda p: json.loads((ROOT / "data" / p).read_text(encoding="utf-8"))
    idx, later = {}, {}
    try:
        words, verbs, fw = L("en/words.json"), L("en/verbs.json"), L("en/function_words.json")
    except Exception:
        return idx
    for c in words:
        for it in c.get("items", []):
            t = it.get("text", "").lower()
            if " " not in t:
                idx.setdefault(t, it)
                for f in (t + "s", t + "es"): later.setdefault(f, it)
    for c in verbs:
        for it in c.get("items", []):
            t = it.get("text", "").lower()
            idx.setdefault(t, it)
            for f in en_verb_forms(t): later.setdefault(f, it)
    for it in fw.get("items", []):
        for f in it.get("forms", []): idx.setdefault(f, it)
    for k, v in later.items(): idx.setdefault(k, v)
    return idx

def check_gloss_entry(g, where):
    if not isinstance(g, dict) or not str(g.get("ko_pron", "")).strip() or not str(g.get("meaning", "")).strip():
        problems.append(f"{where}: 뜻에 ko_pron·meaning이 있어야 해요")

def check_en_line_words(s, l, where, gl, auto):
    """영어 회화 문장 하나의 모든 단어에 뜻이 있는지."""
    lw = {k.lower(): v for k, v in (l.get("words") or {}).items()}
    sw = {k.lower(): v for k, v in (s.get("words") or {}).items()}
    for k, v in lw.items(): check_gloss_entry(v, f"{where} > words '{k}'")
    seen = {}
    for m in WORD.finditer(str(l.get("text", ""))):
        k = m.group().lower()
        seen[k] = seen.get(k, 0) + 1
        if not (lw.get(f"{k}@{seen[k]}") or lw.get(k) or sw.get(k) or gl.get(k) or auto.get(k)):
            problems.append(f"{where}: '{m.group()}' 뜻이 없어요 (문장·장면 words나 glossary.json에)")

# 일본어: 줄마다 seg("きっぷ/は いくら/ですか。")로 단어·조사를 나눈다. 띄어쓰기·、。？！ 사이가 덩어리, "/"가 조각.
# 자동으로 찾기(일본어): 덩어리 맨 앞이 아닌 조각이 조사(は·を·に…)면 조사 → 기초 단어(お+단어도) → 동사 기본형·활용형
JA_SEP = re.compile(r"[\s、。？！]+")

def ja_units(seg):
    """[(조각, 덩어리 맨 앞이 아닌지)]"""
    out = []
    for chunk in JA_SEP.split(str(seg)):
        if chunk:
            out += [(u, i > 0) for i, u in enumerate(chunk.split("/"))]
    return out

def ja_auto_index():
    L = lambda p: json.loads((ROOT / "data" / p).read_text(encoding="utf-8"))
    try:
        words, verbs, parts = L("ja/words.json"), L("ja/verbs.json"), L("ja/particles.json")
    except Exception:
        return {}, set(), set()
    idx = {}
    for c in words:
        for it in c.get("items", []):
            idx.setdefault(it.get("text"), it)
    for c in words:
        for it in c.get("items", []):
            idx.setdefault("お" + it.get("text", ""), it)
    for v in verbs.get("verbs", []):
        idx.setdefault(v.get("text"), v)
        for f in (v.get("forms") or {}).values():
            idx.setdefault(f.get("text"), v)
    return idx, {p.get("text") for p in parts.get("particles", [])}, {v.get("text") for v in verbs.get("verbs", [])}

def check_ja_line_words(s, l, where, gl, auto, particles, verb_texts):
    seg = l.get("seg")
    if not str(seg or "").strip():
        problems.append(f"{where}: seg(단어·조사 나누기)가 없어요")
        return
    if str(seg).replace("/", "") != l.get("text"):
        problems.append(f"{where}: seg에서 /를 빼면 text와 같아야 해요 — '{seg}'")
    lw, sw = l.get("words") or {}, s.get("words") or {}
    for k, v in lw.items(): check_gloss_entry(v, f"{where} > words '{k}'")
    seen = {}
    for u, mid in ja_units(seg):
        if not u:
            problems.append(f"{where}: seg에 빈 조각이 있어요 ('//' 또는 덩어리 끝의 '/')")
            continue
        seen[u] = seen.get(u, 0) + 1
        g = lw.get(f"{u}@{seen[u]}") or lw.get(u) or sw.get(u) or gl.get(u)
        if not g and not (mid and u in particles) and u not in auto:
            problems.append(f"{where}: '{u}' 뜻이 없어요 (문장·장면 words나 glossary.json에)")
        if isinstance(g, dict) and g.get("base") and g["base"] not in verb_texts:
            problems.append(f"{where}: '{u}'의 base '{g['base']}'가 동사 변형 표에 없어요")

def check_glossary(data, name):
    for k, v in (data.get("words") or {}).items():
        if k != k.lower():
            problems.append(f"{name} > '{k}': 키는 소문자로 써요")
        check_gloss_entry(v, f"{name} > '{k}'")

def check_situations(data, name):
    en = name.startswith("en/")
    gl, auto = (glossary("en"), en_auto_index()) if en else ({}, {})
    if not en:
        gl = glossary("ja")
        ja_auto, ja_parts, ja_verbs = ja_auto_index()
        for k, v in gl.items():
            if isinstance(v, dict) and v.get("base") and v["base"] not in ja_verbs:
                problems.append(f"ja/glossary.json > '{k}': base '{v['base']}'가 동사 변형 표에 없어요")
    words_of = (lambda s, l, w: check_en_line_words(s, l, w, gl, auto)) if en else \
               (lambda s, l, w: check_ja_line_words(s, l, w, gl, ja_auto, ja_parts, ja_verbs))
    for s in data:
        need(s, ["scene"], f"{name} 장면")
        for k, v in (s.get("words") or {}).items():
            check_gloss_entry(v, f"{name} > {s.get('scene')} > 장면 words '{k}'")
        for d in s.get("dialogues", []):
            for k, l in enumerate(d.get("lines", [])):
                w = f"{name} > {s.get('scene')} > {d.get('title')} > {k + 1}번 줄"
                need(l, ["who"] + BASIC, w)
                if name.startswith("ja/"):
                    check_kanji_text(l.get("text"), l.get("kanji_text"), w)
                words_of(s, l, w)
        for k, ph in enumerate(s.get("phrases", [])):
            w = f"{name} > {s.get('scene')} > 핵심 문장 {k + 1}번"
            need(ph, BASIC, w)
            check_freq(ph, w)
            if name.startswith("ja/"):
                check_kanji_text(ph.get("text"), ph.get("kanji_text"), w)
            words_of(s, ph, w)

def check_conjugation(data, name):
    gids = {g.get("id") for g in data.get("groups", [])}
    forms = data.get("forms", [])
    for i, f in enumerate(forms):
        need(f, ["id", "name"], f"{name} > 활용형 {i + 1}번")
    fids = [f.get("id") for f in forms]
    seen = set()
    for i, v in enumerate(data.get("verbs", [])):
        where = f"{name} > {i + 1}번 ({v.get('text', '?')})"
        need(v, ["id"] + BASIC, where)
        check_freq(v, where)
        if v.get("id") in seen:
            problems.append(f"{where}: 중복된 id예요")
        seen.add(v.get("id"))
        if v.get("group") not in gids:
            problems.append(f"{where}: group '{v.get('group')}'이 groups에 없어요")
        if "kanji" not in v:
            problems.append(f"{where}: 'kanji' 칸이 없어요 (한자가 없으면 null)")
        if v.get("text") and not HIRAGANA.match(v["text"]):
            problems.append(f"{where}: text는 히라가나로만 써요")
        warn_long_chunk(v.get("text", ""), where)  # 동사 상세 화면의 큰 글자
        vf = v.get("forms", {})
        for fid in fids:
            if fid not in vf:
                problems.append(f"{where}: 활용형 '{fid}'이 없어요")
                continue
            need(vf[fid], BASIC, f"{where} > {fid}")
            t = vf[fid].get("text")
            if t and not HIRAGANA.match(t):
                problems.append(f"{where} > {fid}: text는 히라가나로만 써요")
        if "example" not in v:
            problems.append(f"{where}: 예문(example)이 없어요")
        else:
            need(v["example"], BASIC, f"{where} > 예문")
            check_kanji_text(v["example"].get("text"), v["example"].get("kanji_text"), f"{where} > 예문")
    # 헷갈리는 동사 비교 (ある/いる): 작은 말과 같은 sides 모양, 퀴즈는 공통 형식(check_quiz)
    verbs = {v.get("id"): v.get("text") for v in data.get("verbs", [])}
    known = ja_word_texts()
    def jsentence(ex, w, mark):
        need(ex, BASIC, w)
        check_kanji_text(ex.get("text"), ex.get("kanji_text"), w)
        if mark not in ex.get("text", ""):
            problems.append(f"{w}: 예문에 {mark} 표시가 없어요")
        for x in ex.get("words") or []:
            if x not in known:
                problems.append(f"{w}: '{x}'는 words.json에 없는 단어예요")
    for i, c in enumerate(data.get("compare", [])):
        where = f"{name} > 비교 {i + 1}번 ({c.get('title', '?')})"
        need(c, ["id", "title"], where)
        sides = c.get("sides") or []
        if len(sides) != 2:
            problems.append(f"{where}: sides는 두 쪽이에요")
            continue
        for s in sides:
            if verbs.get(s.get("entry")) != s.get("label"):
                problems.append(f"{where}: '{s.get('label')}'가 동사 '{s.get('entry')}'와 맞지 않아요")
            check_chunks(s.get("point"), f"{where} > {s.get('label')} point", (1, 1))
        labels = [s.get("label", "") for s in sides]
        seen_sides = set()
        for k, ex in enumerate(c.get("examples", [])):
            w = f"{where} > 예문 {k + 1}번"
            if ex.get("side") not in (0, 1):
                problems.append(f"{w}: side는 0 또는 1이에요")
                continue
            seen_sides.add(ex["side"])
            need(ex, ["why"], w)
            jsentence(ex, w, f"[{labels[ex['side']]}]")
        if seen_sides != {0, 1}:
            problems.append(f"{where}: 두 쪽 모두 예문이 있어야 해요")
        if not c.get("quiz"):
            problems.append(f"{where}: 퀴즈가 없어요")
        for k, q in enumerate(c.get("quiz", [])):
            check_quiz(q, labels, f"{where} > 퀴즈 {k + 1}번", ja=True)

# ── 수업 (data/<언어>/lessons.json) ──
# 레슨은 재료를 이름으로 가리킨다 (views.js와 같은 모양, js/lessons.js lessonRef):
#  w:주제/단어  v:주제/동사  fw:작은말id  pt:조사  p:틀(+fills)  ph:장면/문장  d:장면/대화 제목(+lines)  ld:레슨 대화 id  tip:알아두기 id  q:파일/비교id/번호
LESSON_MAX_WORDS = 8          # 레슨마다 새 단어 최대
LESSON_UNKNOWN_WARN = 4       # 앞 레슨까지 안 배운 단어가 대화에 이만큼 이상 나오면 경고

def lesson_sources(lang):
    L = lambda p: json.loads((ROOT / "data" / p).read_text(encoding="utf-8"))
    def opt(p, empty):
        try: return L(p)
        except Exception: return empty
    return {"words": opt(f"{lang}/words.json", []), "verbs": opt(f"{lang}/verbs.json", [] if lang == "en" else {}),
            "fw": opt(f"{lang}/function_words.json", {}), "particles": opt(f"{lang}/particles.json", {}),
            "patterns": opt(f"{lang}/patterns.json", []), "situations": opt(f"{lang}/situations.json", []),
            "tips": opt(f"{lang}/tips.json", {}), "lang": lang}

def lesson_word(src, ref):
    """w:/v:/fw:/pt: → (항목, 문장 속 모양들) 또는 None"""
    kind, _, rest = ref.partition(":")
    if kind in ("w", "v") and "/" in rest:
        cat, _, text = rest.partition("/")
        data = src["words"] if kind == "w" else src["verbs"]
        if isinstance(data, list):
            for c in data:
                if c.get("category") == cat:
                    it = next((i for i in c.get("items", []) if i.get("text") == text), None)
                    if it:
                        t = text.lower()
                        forms = [t] + (en_verb_forms(t) if kind == "v" else [t + "s", t + "es"])
                        return it, forms
        elif kind == "v":                                   # 일본어 동사 변형 표: v:-/いく
            v = next((x for x in data.get("verbs", []) if x.get("text") == text), None)
            if v: return v, [v["text"]] + [f.get("text") for f in (v.get("forms") or {}).values()]
        return None
    if kind == "fw":
        it = next((i for i in src["fw"].get("items", []) if i.get("id") == rest), None)
        return (it, list(it.get("forms", []))) if it else None
    if kind == "pt":
        it = next((i for i in src["particles"].get("particles", []) if i.get("text") == rest), None)
        return (it, [rest]) if it else None
    return None

def lesson_dialogue(src, own, item):
    """{ref: d:/ld:, lines?} → (대화 줄 목록, 장면(words 칸)) 또는 None"""
    ref = item.get("ref", "")
    kind, _, rest = ref.partition(":")
    if kind == "ld":
        d = own.get(rest)
        if not d: return None
        lines = d.get("lines", [])
        scene = d
    elif kind == "d" and "/" in rest:
        sc, _, title = rest.partition("/")
        s = next((x for x in src["situations"] if x.get("scene") == sc), None)
        d = s and next((x for x in s.get("dialogues", []) if x.get("title") == title), None)
        if not d: return None
        lines, scene = d.get("lines", []), s
    else:
        return None
    pick = item.get("lines")
    if pick is not None:
        if any(not isinstance(i, int) or not 0 <= i < len(lines) for i in pick): return None
        lines = [lines[i] for i in pick]
    return lines, scene

def lesson_core_texts(src, item):
    """핵심 재료 → 그 재료의 문장들 (새 단어가 나오는지 볼 때 쓴다). 없으면 None"""
    ref = item.get("ref", "")
    kind, _, rest = ref.partition(":")
    if kind == "p":
        p = next((x for x in src["patterns"] if x.get("pattern") == rest), None)
        if not p: return None
        fills = item.get("fills") or [f.get("text") for f in p.get("fills", [])]
        have = {f.get("text") for f in p.get("fills", [])}
        if any(f not in have for f in fills): return None
        return [rest.replace("___", f) for f in fills]
    if kind == "ph" and "/" in rest:
        sc, _, text = rest.partition("/")
        s = next((x for x in src["situations"] if x.get("scene") == sc), None)
        return [text] if s and any(ph.get("text") == text for ph in s.get("phrases", [])) else None
    if kind == "tip":
        t = next((x for x in src["tips"].get("tips", []) if x.get("id") == rest), None)
        return [str(e.get("text", "")).replace("[", "").replace("]", "") for e in t.get("examples", [])] if t else None
    if kind in ("fw", "pt"):
        r = lesson_word(src, ref)
        if not r: return None
        return [str(ex.get("text", "")).replace("[", "").replace("]", "") for u in r[0].get("uses", []) for ex in u.get("examples", [])]
    return None

def lesson_tokens(lang, texts):
    if lang == "ja":
        return [u for t in texts for u, _ in ja_units(t)]
    return [m.group().lower() for t in texts for m in WORD.finditer(str(t))]

def check_lessons(data, name):
    lang = name.split("/")[0]
    src = lesson_sources(lang)
    gl = glossary(lang)
    auto = en_auto_index() if lang == "en" else {}
    ja_auto, ja_parts, ja_verbs = ja_auto_index() if lang == "ja" else ({}, set(), set())
    own = {}
    for i, d in enumerate(data.get("dialogues", [])):
        where = f"{name} > 레슨 대화 {i + 1}번 ({d.get('id', '?')})"
        need(d, ["id", "title"], where)
        if d.get("id") in own: problems.append(f"{where}: 중복된 id예요")
        own[d.get("id")] = d
        for k, l in enumerate(d.get("lines", [])):
            w = f"{where} > {k + 1}번 줄"
            need(l, ["who"] + BASIC, w)
            if lang == "en": check_en_line_words(d, l, w, gl, auto)
            else:
                check_kanji_text(l.get("text"), l.get("kanji_text"), w)
                check_ja_line_words(d, l, w, gl, ja_auto, ja_parts, ja_verbs)
    known = {w.lower() for w in data.get("known_from_start", [])}
    ids = set()
    for ui, u in enumerate(data.get("units", [])):
        uw = f"{name} > 단원 {ui + 1} ({u.get('title', '?')})"
        need(u, ["id", "title", "goal"], uw)
        lessons = u.get("lessons", [])
        if not 4 <= len(lessons) <= 5 or not lessons[-1].get("review"):
            problems.append(f"{uw}: 레슨 3~4개 + 마지막에 복습 레슨(review: true) 하나여야 해요")
        for li, les in enumerate(lessons):
            where = f"{uw} > {li + 1}번 레슨 ({les.get('id', '?')})"
            need(les, ["id", "title", "goal"], where)
            if les.get("id") in ids: problems.append(f"{where}: 중복된 id예요")
            ids.add(les.get("id"))
            # 대화
            dlg_texts = []
            if not les.get("dialogues"): problems.append(f"{where}: 대화(dialogues)가 없어요")
            for item in les.get("dialogues", []):
                r = lesson_dialogue(src, own, item)
                if not r: problems.append(f"{where}: 대화 '{item.get('ref')}'(lines {item.get('lines')})를 찾을 수 없어요"); continue
                dlg_texts += [l.get("text", "") for l in r[0]]
            # 핵심
            core_texts = []
            for item in les.get("core", []):
                t = lesson_core_texts(src, item)
                if t is None: problems.append(f"{where}: 핵심 재료 '{item.get('ref')}'(fills {item.get('fills')})를 찾을 수 없어요"); continue
                core_texts += t
            # 새 단어: 있는지, 8개 이하, 대화·문장에 실제로 나오는지
            words = les.get("words", [])
            if len(words) > LESSON_MAX_WORDS: problems.append(f"{where}: 새 단어가 {len(words)}개예요 ({LESSON_MAX_WORDS}개까지)")
            if not les.get("review") and not words: problems.append(f"{where}: 새 단어가 없어요")
            toks = lesson_tokens(lang, dlg_texts + core_texts)
            joined = " " + " ".join(toks) + " "
            for ref in words:
                r = lesson_word(src, ref)
                if not r: problems.append(f"{where}: 새 단어 '{ref}'를 찾을 수 없어요"); continue
                forms = [f.lower() for f in r[1] if f]
                if not any((" " + f + " ") in joined for f in forms):
                    problems.append(f"{where}: 새 단어 '{ref}'가 이 레슨의 대화나 문장에 안 나와요")
                known |= set(forms) | {p for f in forms for p in f.split()}    # good morning → good, morning 도
            known |= set(lesson_tokens(lang, core_texts))   # 핵심 문장(패턴 문장·핵심 문장)에서 배운 말
            for item in les.get("core", []):                # 배운 패턴의 틀 단어·작은 말도 아는 말로
                kind, _, rest = item.get("ref", "").partition(":")
                if kind == "p": known |= set(lesson_tokens(lang, [rest.replace("___", " ")]))
                if kind in ("fw", "pt"):
                    r = lesson_word(src, item["ref"])
                    if r: known |= {f.lower() for f in r[1]}
            # 앞 레슨까지 안 배운 단어가 대화에 너무 많은지 (경고)
            unknown = sorted({t for t in lesson_tokens(lang, dlg_texts) if t not in known and not t.isdigit()})
            if len(unknown) >= LESSON_UNKNOWN_WARN and not les.get("review"):
                warnings.append(f"{where}: 아직 안 배운 말이 대화에 {len(unknown)}개 나와요 — {', '.join(unknown)}")
            # 확인 문제
            for k, q in enumerate(les.get("quiz", [])):
                w = f"{where} > 문제 {k + 1}번"
                if "ref" in q:
                    m = re.fullmatch(r"q:([^/]+)/([^/]+)/(\d+)", q["ref"])
                    try:
                        c = m and next((x for x in json.loads((ROOT / f"data/{lang}/{m.group(1)}.json").read_text(encoding="utf-8"))["compare"]
                                        if x.get("id") == m.group(2)), None)
                    except Exception:
                        c = None
                    if not c or int(m.group(3)) >= len(c.get("quiz", [])):
                        problems.append(f"{w}: 퀴즈 '{q['ref']}'를 찾을 수 없어요")
                    continue
                if len(q.get("choices", [])) < 2: problems.append(f"{w}: 보기(choices)가 두 개 이상이어야 해요")
                check_quiz(q, q.get("choices", []), w, ja=lang == "ja")

CHECKERS = {"words": check_cards, "verbs": check_cards, "particles": check_cards,
            "patterns": check_patterns, "situations": check_situations, "pairs": check_pairs,
            "glossary": check_glossary, "lessons": check_lessons}
# 같은 파일 이름이라도 언어에 따라 형식이 다를 때 (core.js의 섹션 type과 맞춘다)
CHECKERS_BY_LANG = {"ja/verbs": check_conjugation, "ja/words": check_ja_cards, "ja/particles": check_particles,
                    "en/pattern_compare": check_pattern_compare, "en/tips": check_tips,
                    "en/function_words": check_function_words}
# 검사기마다 기대하는 맨 바깥 모양
SHAPES = {check_conjugation: dict, check_particles: dict, check_pattern_compare: dict, check_pairs: dict, check_tips: dict, check_glossary: dict, check_lessons: dict,
          check_function_words: dict}

def check_offline():
    """sw.js의 오프라인 저장 목록(PRECACHE)이 실제 파일과 맞는지, 글꼴 주소가 index.html과 같은지."""
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    m = re.search(r"const PRECACHE = \[(.*?)\];", sw, re.S)
    if not m:
        problems.append("sw.js: PRECACHE 목록을 찾지 못했어요")
        return
    listed = set(re.findall(r'"([^"]+)"', m.group(1)))
    need = {"index.html", "manifest.webmanifest"}
    for pattern in ("data/**/*.json", "js/*.js", "css/*.css", "icons/*.png"):
        need |= {p.relative_to(ROOT).as_posix() for p in ROOT.glob(pattern)}
    for p in sorted(need - listed):
        problems.append(f"sw.js: '{p}'가 PRECACHE에 없어요 (오프라인에서 안 열려요)")
    for p in sorted(listed - {"./"}):
        if not (ROOT / p).exists():
            problems.append(f"sw.js: PRECACHE의 '{p}' 파일이 없어요")
    font = re.search(r'const FONT_CSS = "([^"]+)"', sw)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    if not font or f'href="{font.group(1)}"' not in html:
        problems.append("sw.js: FONT_CSS가 index.html의 Google 글꼴 주소와 달라요")
    print("검사함: sw.js 오프라인 목록")

def main():
    files = sorted((ROOT / "data").rglob("*.json"))
    for f in files:
        name = f"{f.parent.name}/{f.name}"
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            problems.append(f"{name}: JSON 형식 오류 — {e.msg} ({e.lineno}번째 줄)")
            continue
        checker = CHECKERS_BY_LANG.get(f"{f.parent.name}/{f.stem}") or CHECKERS.get(f.stem)
        if checker:
            shape = SHAPES.get(checker, list)
            if not isinstance(data, shape):
                problems.append(f"{name}: 형식이 달라요 — 맨 바깥이 {'{ }' if shape is dict else '[ ]'}여야 해요")
                continue
            checker(data, name)
            print(f"검사함: {name}")
    check_fw_links()
    check_freq_pairs()
    check_offline()
    if warnings:
        print(f"\n경고 {len(warnings)}개 (검사는 멈추지 않아요):")
        for w in warnings:
            print(" -", w)
    if problems:
        print(f"\n문제 {len(problems)}개:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("\n문제 없어요.")

if __name__ == "__main__":
    main()
