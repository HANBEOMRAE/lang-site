"""한 파일짜리 미리보기 만들기.
CSS, JS, data/*.json을 index.html 하나에 모두 넣어 dist/preview.html로 저장한다.
서버 없이 더블클릭으로 열거나, 휴대폰으로 보내 확인할 때 쓴다.

실행: python tools/build_preview.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    # CSS 넣기
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)

    # 데이터 모으기
    data = {}
    for f in sorted((ROOT / "data").rglob("*.json")):
        data[f"{f.parent.name}/{f.stem}"] = json.loads(f.read_text(encoding="utf-8"))
    embedded = "<script>\nwindow.EMBEDDED_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n</script>\n"

    # JS 넣기 (첫 스크립트 앞에 데이터)
    first = True
    def js(m):
        nonlocal first
        code = "<script>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</script>"
        if first:
            first = False
            return embedded + code
        return code
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)

    out = ROOT / "dist" / "preview.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"만들었어요: {out}  ({len(html):,} bytes, 데이터 파일 {len(data)}개)")

if __name__ == "__main__":
    main()
