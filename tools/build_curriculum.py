# 커리큘럼 수정 페이지(구글 시트) 내용 → 태블릿 사이트 커리큘럼 탭
#   1) node tools/export_from_editor.mjs            (수정 페이지에서 읽기만 해서 내보내기)
#   2) python -I -X utf8 tools/build_curriculum.py  (curriculum/data.json, curriculum/cx.css 만들기)
# 사용자가 '적용' 지시할 때만 돌린다(수정 페이지의 승인 흐름과 별개로 사이트가 바로 바뀌지 않게).
import json
import os
import re
import sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFT = 'D:/Projects/curriculum-dept-draft'
SRC = sys.argv[1] if len(sys.argv) > 1 else DRAFT + '/data/site_export.json'
OUT = os.path.join(SITE, 'curriculum')
os.makedirs(OUT, exist_ok=True)

d = json.load(open(SRC, encoding='utf-8'))

# ── 학과·과정 순서: 로드맵을 따름. 수정 페이지보다 로드맵이 앞선 곳은 여기서 맞춤 ──
# 시각편집(11/27 로드맵): 그래픽아트웍 → 브랜딩디자인 → 인디자인 → 컴퓨터그래픽기능사 → AI시각디자인 → AI편집포폴 → AI디자인수익화
def fix_l3(line, lines):
    rows = {r.get('name'): r for r in line['rows'] if not r.get('hub')}
    hub = [r for r in line['rows'] if r.get('hub')]
    l9 = next(l for l in lines if l['id'] == 'l9')
    cert = next(r for r in l9['rows'] if r.get('name') == '국가기술자격증')
    def pick(old, new, **kw):
        r = dict(rows[old]); r['name'] = new; r.update(kw); return r
    line['rows'] = hub + [
        pick('AI그래픽아트웍', '그래픽아트웍', t='g', desc='비주얼 합성 · 아트웍 심화'),
        pick('AI브랜딩디자인', '브랜딩디자인', t='g'),
        dict(rows['인디자인']),
        {'name': '컴퓨터그래픽기능사', 't': 'g', 'desc': '국가기술자격 실기 대비', 'day': cert.get('day'),
         'wk': cert.get('wk'), 'src': ['d01|컴퓨터그래픽기능사']},
        dict(rows['AI시각디자인']), dict(rows['AI편집포폴']), dict(rows['AI디자인수익화']),
    ]

KEEP_LINE = ['id', 'name', 'tab', 'color', 'ink', 'group', 'solo', 'ex']
KEEP_ROW = ['name', 't', 'src', 'parts', 'day', 'wk', 'badge', 'note', 'desc', 'hub', 'pf', 'stock']
lines = []
for l in d['lines']:
    if l['id'] == 'l3':
        fix_l3(l, d['lines'])
    nl = {k: l[k] for k in KEEP_LINE if l.get(k) not in (None, '', [])}
    nl['rows'] = [{k: r[k] for k in KEEP_ROW if r.get(k) not in (None, '', [])} for r in l['rows']]
    for r in nl['rows']:
        if r.get('day') not in ('both', 'week', 'end'):
            r.pop('day', None)   # 신설 예정·시수 조정 중 같은 내부 표시는 사이트에 안 보임
    lines.append(nl)

used = {k for l in lines for r in l['rows'] for k in r.get('src', [])}
records = {}
for k in sorted(used):
    r = d['records'].get(k)
    if not r:
        continue
    o = {'title': r['title'], 'items': r['items'], 'imgs': [u for u in r['imgs'] if re.match(r'^https://', u)]}
    if r.get('info'):
        o['info'] = r['info']
    records[k] = o
pf = {k: v for k, v in d['pf'].items() if any(r.get('pf') == k for l in lines for r in l['rows'])}
data = {'lines': lines, 'records': records, 'pf': pf}
open(os.path.join(OUT, 'data.json'), 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, separators=(',', ':')))

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

n_rows = sum(1 for l in lines for r in l['rows'] if not r.get('hub'))
print('lines', len(lines), 'course rows', n_rows, 'records', len(records), 'pf', list(pf),
      'data KB', os.path.getsize(os.path.join(OUT, 'data.json')) // 1024, 'css KB', os.path.getsize(os.path.join(OUT, 'cx.css')) // 1024)
