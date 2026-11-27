# 커리큘럼 탭 화면 스타일(curriculum/cx.css) 만들기 — 수정 페이지의 보기 화면 스타일을 섀도 DOM용으로
#   python -I -X utf8 tools/build_curriculum.py   (수정 페이지 화면 스타일이 바뀌었을 때만)
# 내용은 api/curriculum.js 가 수정 페이지에서 3분마다 자동으로 받아 옴(예비본: node tools/snapshot_curriculum.mjs)
import os
import re

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFT = 'D:/Projects/curriculum-dept-draft'
OUT = os.path.join(SITE, 'curriculum')
os.makedirs(OUT, exist_ok=True)

# ── 화면 스타일: 수정 페이지의 보기 화면 스타일 + 보기용 추가분, 섀도 DOM 안에서 쓰도록 바꿈 ──
html = open(DRAFT + '/gas/Index.html', encoding='utf-8').read()
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
css = css[:css.index('/* ── 수정 화면 추가 스타일')]
reps = [
    (':root {', ':host {'),
    ('html, body { height: 100%; margin: 0; background: var(--c-bg); color: var(--c-text); }',
     ':host { display: block; height: 100%; background: var(--c-bg); color: var(--c-text); }'),
    ('  body { font-family: var(--font);', '  :host { font-family: var(--font);'),
    ('height: 100vh; height: 100dvh; display: grid;', 'height: 100%; display: grid;'),
    ('.lb { position: fixed; inset: 0; z-index: 50;', '.lb { position: fixed; inset: 0; z-index: 1000;'),
]
for a, b in reps:
    assert css.count(a) == 1, a
    css = css.replace(a, b)
css += """
  /* ── 수정 페이지에서 바뀐 보기 규칙(11/27): 주제 제목 크게·설명 흐리게, 달마다 1~4week ── */
  [hidden] { display: none !important; }
  .wk-t { font-size: 1.34rem; font-weight: 800; color: #0b1220; }
  .wk-d { margin-top: 6px; font-size: .95rem; font-weight: 500; color: #6b7280; }
  .wk-b + .wk-b { margin-top: 18px; }
  .mon-h b, .mon-h span { flex-shrink: 0; }
  .mon-h { justify-content: flex-start; }
  .mon-h em { flex: 1; min-width: 0; font-size: .92rem; font-style: normal; font-weight: 800; color: #111; }
  .wk-n--w { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
  .wk-n--w b { font-size: .98rem; font-weight: 900; line-height: 1; }
  .wk-n--w small { font-size: .56rem; font-weight: 700; line-height: 1; letter-spacing: 0; opacity: .85; }
  @media (max-width: 1300px) { .wk-t { font-size: 1.22rem; } .wk-d { font-size: .88rem; } }

  /* ── 태블릿 사이트 안에서: 위쪽 줄은 범례만(제목·PDF는 사이트 쪽), 휴대폰에선 뒤로·현재 위치 ── */
  .app { max-width: none; }
  .top { min-height: 48px; padding: 8px 14px; }
  .top-t { display: none; margin: 0; font-size: 1rem; font-weight: 800; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cx-msg { display: grid; place-items: center; height: 100%; padding: 24px; text-align: center; color: var(--c-text-2); font-size: .95rem; line-height: 1.6; }
  .cx-msg button { margin-top: 10px; padding: 9px 16px; border-radius: 9px; border: 1px solid var(--c-border); font-weight: 700; text-align: center; }
  @media (max-width: 960px) { .top { display: none; } }   /* 세로 태블릿: 범례가 숨으니 빈 줄도 숨김 */
  @media (max-width: 680px), (max-height: 520px) { .top { display: flex; } .top-t { display: block; } }
"""
open(os.path.join(OUT, 'cx.css'), 'w', encoding='utf-8').write(css)

print('css KB', os.path.getsize(os.path.join(OUT, 'cx.css')) // 1024)
