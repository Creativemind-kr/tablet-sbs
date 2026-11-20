# -*- coding: utf-8 -*-
"""
학과별 로드맵(2호선 노선도) PDF → 사이트용 자료 만들기

하는 일
  1) PDF에서 글씨를 모두 지운 '배경 그림'을 images/roadmap/ai-roadmap-line2-bg.webp 로 저장
  2) PDF의 글씨(위치·크기·굵기·색)를 index.html 의 RMAP_TEXTS 블록에 써 넣음
     → 사이트 편집 모드에서 글씨를 바로 고칠 수 있음(고친 내용은 Firestore ui.roadmapMap 에 저장)

사용법
  python -I tools/roadmap_from_pdf.py "PDF경로"

주의
  - 글씨 번호(t000~)는 PDF 안 글씨 순서대로 매겨짐. PDF를 새로 바꾸면 번호가 달라질 수 있어서
    예전에 편집 모드에서 고친 글씨가 엉뚱한 자리에 붙을 수 있음 → 새 PDF로 바꿀 땐 고친 글씨를 먼저 확인.
  - tools/rmap_ls.json 이 있으면 글씨별 자간(브라우저 실측 보정값)을 함께 넣음.
"""
import json
import os
import re
import sys

import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_OUT = os.path.join(ROOT, 'images', 'roadmap', 'ai-roadmap-line2-bg.webp')
HTML = os.path.join(ROOT, 'index.html')
LS_JSON = os.path.join(ROOT, 'tools', 'rmap_ls.json')
SCALE = 3          # 2000pt → 6000px
INNER_RIGHT = 1389  # 순환선 오른쪽 안쪽(인디자인·프리미어·에펙) = 오른쪽 맞춤
INNER_LEFT = 611    # 순환선 왼쪽 안쪽(ITQ·Ai유튜브·C언어) = 왼쪽 맞춤
FOOTER_LEFT = (243, 473, 713, 953, 1193)  # 아래 자격시험 칸 = 왼쪽 맞춤
HEADER_LEFT = ('AI CURRICULUM ROADMAP', '실무 맞춤형 AI 교육과정')

WEIGHT = {'Medium': 500, 'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800}


def align_of(t, x0, x1, y0):
    if abs(x1 - INNER_RIGHT) < 1.6:
        return 'r'
    if abs(x0 - INNER_LEFT) < 1.6:
        return 'l'
    if t.startswith(HEADER_LEFT):
        return 'l'
    if y0 > 1300 and any(abs(x0 - fx) < 2.5 for fx in FOOTER_LEFT):
        return 'l'
    return 'c'


def main(pdf):
    ls = json.load(open(LS_JSON, encoding='utf-8')) if os.path.exists(LS_JSON) else {}

    # 1) 글씨 목록
    doc = pymupdf.open(pdf)
    page = doc[0]
    items = []
    for b in page.get_text('dict')['blocks']:
        if b['type'] != 0:
            continue
        for line in b['lines']:
            for s in line['spans']:
                t = s['text'].strip()
                if not t:
                    continue
                x0, y0, x1, y1 = s['bbox']
                by = s['origin'][1]  # 글자 바닥선(baseline)
                font = s['font'].split('+')[-1]
                if font.startswith('Paperlogy'):
                    fam, w = 'pl', (900 if 'Black' in font else 800)
                else:
                    fam, w = 'pre', WEIGHT.get(font.split('-')[-1], 500)
                a = align_of(t, x0, x1, y0)
                ax = {'l': x0, 'c': (x0 + x1) / 2, 'r': x1}[a]
                k = 't%03d' % len(items)
                items.append([k, t, round(ax, 2), round(by, 2), round(s['size'], 2), w,
                              '#%06x' % s['color'], a, fam, round(x1 - x0, 1), ls.get(k, 0)])

    # 세부 글씨 표시(1) — 전체 보기에선 숨기고 확대하면 보임
    #   역 아래 과목 목록·안내 문장(Medium), 아래 자격시험 설명(SemiBold 8.5), 범례 둘째 줄(SemiBold 8.0 중 아래 줄)
    for it in items:
        t, ax, by, size, w = it[1], it[2], it[3], it[4], it[5]
        d = w == 500 or (w == 600 and size == 8.5)
        if w == 600 and size == 8.0:
            d = any(o is not it and o[5] == 600 and o[4] == 8.0 and abs(o[2] - ax) < 4 and o[3] < by for o in items)
        it.append(1 if d else 0)

    # 2) 글씨 없는 배경
    page.add_redact_annot(page.rect, fill=False)
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                          graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                          text=pymupdf.PDF_REDACT_TEXT_REMOVE)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    img.save(BG_OUT, 'WEBP', quality=86, method=6)

    # 3) index.html 의 RMAP_TEXTS 블록 교체
    js = ',\n'.join('  ' + json.dumps(it, ensure_ascii=False) for it in items)
    block = ('/* RMAP_TEXTS:BEGIN — tools/roadmap_from_pdf.py 가 자동 생성. 직접 고치지 말고 사이트 편집 모드로 고치기 */\n'
             '// [번호, 글씨, 기준x, 바닥선y, 글자크기, 굵기, 색, 맞춤(l/c/r), 글꼴(pre/pl), PDF폭, 자간, 세부(1=확대 시에만)] — 단위: PDF pt(노선도 폭 2000)\n'
             'const RMAP_TEXTS = [\n' + js + '\n];\n/* RMAP_TEXTS:END */')
    html = open(HTML, encoding='utf-8').read()
    pat = re.compile(r'/\* RMAP_TEXTS:BEGIN.*?/\* RMAP_TEXTS:END \*/', re.S)
    if not pat.search(html):
        sys.exit('index.html 에 RMAP_TEXTS 블록 표시가 없음')
    html = pat.sub(lambda m: block, html, count=1)
    open(HTML, 'w', encoding='utf-8', newline='').write(html)
    print(f'글씨 {len(items)}개, 배경 {os.path.getsize(BG_OUT) // 1024}KB')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
