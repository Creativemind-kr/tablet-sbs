# -*- coding: utf-8 -*-
"""
학과별 로드맵(2호선 노선도) PDF → 사이트용 자료 만들기

하는 일
  1) PDF에서 글씨를 모두 지운 '배경 그림'을 images/roadmap/ai-roadmap-line2-bg.webp 로 저장
     (PDF 바깥 회색 여백·카드 테두리는 잘라내고 흰 바탕으로 → 사이트 화면과 이어 보이게)
  2) PDF의 글씨(위치·크기·굵기·색)를 index.html 의 RMAP_TEXTS 블록에 써 넣음
     → 사이트 편집 모드에서 글씨를 바로 고칠 수 있음(고친 내용은 Firestore ui.roadmapMap 에 저장)

사용법
  python -I tools/roadmap_from_pdf.py "PDF경로"

주의
  - 글씨 번호(t000~)는 PDF 안 글씨 순서대로 매겨짐. PDF를 새로 바꾸면 번호가 달라질 수 있어서
    예전에 편집 모드에서 고친 글씨가 엉뚱한 자리에 붙을 수 있음 → 새 PDF로 바꿀 땐 고친 글씨를 먼저 확인.
  - tools/rmap_ls.json 이 있으면 글씨별 자간(브라우저 실측 보정값)을 함께 넣음.
    PDF를 바꾸면 이 파일은 지우고 다시 실측해야 함(번호가 바뀌므로).
  - CROP·CONTENT 값은 2000×1414pt 노선도 기준. 판 크기·여백이 바뀐 PDF면 다시 맞춰야 함.
"""
import json
import os
import re
import sys

import pymupdf
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_OUT = os.path.join(ROOT, 'images', 'roadmap', 'ai-roadmap-line2-bg.webp')
HTML = os.path.join(ROOT, 'index.html')
LS_JSON = os.path.join(ROOT, 'tools', 'rmap_ls.json')
SCALE = 3                            # 1pt → 3px
CROP = (36, 28, 1964, 1386)          # 잘라 쓸 영역(pt): 카드 테두리 안쪽
CONTENT = (43, 35, 1957, 1377.6)     # 실제 그림이 있는 영역 — 이 바깥은 흰색으로 칠함(둥근 모서리·테두리 지우기)
HEADER_LEFT = ('AI CURRICULUM ROAD', '실무 맞춤형 AI 교육과정')
FOOTER_LEFT = (243, 473, 713, 953, 1193)  # 아래 자격시험 칸 = 왼쪽 맞춤

WEIGHT = {'Medium': 500, 'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800}


def align_of(t, x0, y0):
    if t.startswith(HEADER_LEFT):
        return 'l'
    if y0 > 1300 and any(abs(x0 - fx) < 2.5 for fx in FOOTER_LEFT):
        return 'l'
    return 'c'


def main(pdf):
    ls = json.load(open(LS_JSON, encoding='utf-8')) if os.path.exists(LS_JSON) else {}
    ox, oy = CROP[0], CROP[1]

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
                a = align_of(t, x0, y0)
                ax = {'l': x0, 'c': (x0 + x1) / 2, 'r': x1}[a]
                k = 't%03d' % len(items)
                items.append([k, t, round(ax - ox, 2), round(by - oy, 2), round(s['size'], 2), w,
                              '#%06x' % s['color'], a, fam, round(x1 - x0, 1), ls.get(k, 0)])

    # 세부 글씨 표시(1) — 전체 보기에선 숨기고 확대하면 보임
    #   역 아래 과목 설명(Medium), 아래 자격시험 설명(SemiBold 8.5 이하)
    for it in items:
        size, w = it[4], it[5]
        it.append(1 if (w == 500 or (w == 600 and size <= 8.5)) else 0)

    # 2) 글씨 없는 배경
    page.add_redact_annot(page.rect, fill=False)
    page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                          graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
                          text=pymupdf.PDF_REDACT_TEXT_REMOVE)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=pymupdf.Rect(*CROP), alpha=False)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    cx0, cy0 = round((CONTENT[0] - ox) * SCALE), round((CONTENT[1] - oy) * SCALE)
    cx1, cy1 = round((CONTENT[2] - ox) * SCALE), round((CONTENT[3] - oy) * SCALE)
    white = Image.new('RGB', img.size, (255, 255, 255))
    mask = Image.new('L', img.size, 255)
    ImageDraw.Draw(mask).rectangle([cx0, cy0, cx1, cy1], fill=0)
    img.paste(white, (0, 0), mask)
    img.save(BG_OUT, 'WEBP', quality=86, method=6)

    # 3) index.html 의 RMAP_TEXTS 블록 교체
    box = [CROP[2] - CROP[0], CROP[3] - CROP[1]]
    js = ',\n'.join('  ' + json.dumps(it, ensure_ascii=False) for it in items)
    block = ('/* RMAP_TEXTS:BEGIN — tools/roadmap_from_pdf.py 가 자동 생성. 직접 고치지 말고 사이트 편집 모드로 고치기 */\n'
             f'const RMAP_BOX = {json.dumps(box)};  // 노선도 크기(pt)\n'
             '// [번호, 글씨, 기준x, 바닥선y, 글자크기, 굵기, 색, 맞춤(l/c/r), 글꼴(pre/pl), PDF폭, 자간, 세부(1=확대 시에만)] — 단위: PDF pt\n'
             'const RMAP_TEXTS = [\n' + js + '\n];\n/* RMAP_TEXTS:END */')
    html = open(HTML, encoding='utf-8').read()
    pat = re.compile(r'/\* RMAP_TEXTS:BEGIN.*?/\* RMAP_TEXTS:END \*/', re.S)
    if not pat.search(html):
        sys.exit('index.html 에 RMAP_TEXTS 블록 표시가 없음')
    html = pat.sub(lambda m: block, html, count=1)
    open(HTML, 'w', encoding='utf-8', newline='').write(html)
    print(f'글씨 {len(items)}개(세부 {sum(i[-1] for i in items)}), 배경 {img.size[0]}×{img.size[1]} '
          f'{os.path.getsize(BG_OUT) // 1024}KB, 노선도 {box[0]}×{box[1]}pt')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
