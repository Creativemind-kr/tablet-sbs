/* 커리큘럼(학과별) — 커리큘럼 수정 페이지(구글 시트)의 내용·화면을 태블릿 사이트로 옮긴 보기 전용 화면
   - 데이터: /curriculum/data.json (tools/build_curriculum.py 로 만듦, 사용자가 '적용' 지시할 때만 갱신)
   - 사이트 스타일과 섞이지 않게 섀도 DOM 안에 그림(스타일: /curriculum/cx.css)
   - 학과 목록 → 과정 → 커리큘럼 글 → 예시 이미지. 휴대폰·낮은 화면은 한 칸씩 넘어감
   - PDF 모듈이 쓰는 함수: CX.load / line / lineName / printBlocks / pfItems */
(function () {
  const DAY = { both: '평일·주말', week: '평일', end: '주말' };
  const LEGEND = [['g', '전공 일반역'], ['a', 'AI 융합역'], ['p', 'PO·완성 종착역'], ['r', '수익화반'], ['b', '창업역']];
  const GROUP = { hub: '공통', main: '메인 학과', sub: '특화 학과', rev: '수익화' };
  const ORG = 'SBS아카데미컴퓨터AIX학원';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const small = u => /^https:\/\/drive\.google\.com\//.test(u) ? u : '/_vercel/image?url=' + encodeURIComponent(u) + '&w=960&q=72';

  let data = null, dataP = null;
  function load() {
    return dataP || (dataP = fetch('/curriculum/data.json', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('커리큘럼을 불러오지 못했어요'); return r.json(); })
      .then(d => (data = d))
      .catch(e => { dataP = null; throw e; }));
  }
  const lineById = id => data && data.lines.find(l => l.id === id);
  const firstRow = l => Math.max(0, l.rows.findIndex(r => !r.hub));
  const recs = r => (r.src || []).map(k => data.records[k]).filter(Boolean);

  /* ── 커리큘럼 글 읽기(수정 페이지와 같은 규칙) ── */
  function parseItems(items) {
    const weeks = []; let w = null, b = null;
    (items || []).forEach(it => {
      if (it.indexOf('## ') === 0) { w = { n: it.slice(3).trim(), b: [] }; weeks.push(w); b = null; return; }
      if (!w) { w = { n: '', b: [] }; weeks.push(w); }
      if (it.indexOf('@month ') === 0) { w.month = it.slice(7); return; }
      if (it.indexOf('# ') === 0) { b = { t: it.slice(2).trim(), d: [], tool: '', out: '' }; w.b.push(b); return; }
      if (!b) { b = { t: '', d: [], tool: '', out: '' }; w.b.push(b); }
      if (it.indexOf('@tool ') === 0) b.tool = it.slice(6);
      else if (it.indexOf('@out ') === 0) b.out = it.slice(5);
      else b.d.push(it);
    });
    return weeks;
  }
  const first = n => { const m = /\d+/.exec(n); return m ? +m[0] : 0; };
  const last = n => { const m = /(\d+)\s*[~–-]\s*(\d+)/.exec(n); return m ? +m[2] : first(n); };
  const isWeekList = weeks => weeks.length > 0 && weeks.every(x => /^\s*week\s*\d/i.test(x.n));
  // 달마다 1~4week로 다시 셈(저장은 Week 01부터 이어지는 번호)
  const inMonth = x => { const a = first(x.n), b = last(x.n), base = (Math.ceil(a / 4) - 1) * 4; return a === b ? String(a - base) : `${a - base}~${b - base}`; };
  const shown = n => { const m = /(\d+)(?:\s*[~–-]\s*(\d+))?/.exec(n); return m ? (m[2] ? `${m[1]}~${m[2]}` : m[1]) + (/개월/.test(n) ? '개월' : '') : '·'; };
  function months(weeks) {
    const out = [];
    weeks.forEach(x => { const m = Math.ceil(first(x.n) / 4); let g = out[out.length - 1]; if (!g || g.m !== m) { g = { m, a: [] }; out.push(g); } g.a.push(x); if (!g.t && x.month) g.t = x.month; });
    return out;
  }
  function weeksHtml(items) {
    const weeks = parseItems(items), isWeek = isWeekList(weeks);
    const circle = x => {
      if (isWeek) return `<div class="wk-n wk-n--w" aria-label="${esc(x.n)}"><b>${esc(inMonth(x))}</b><small>week</small></div>`;
      const v = shown(x.n);
      return `<div class="wk-n${v.length > 3 || /개월/.test(v) ? ' is-long' : ''}" aria-label="${esc(x.n)}">${esc(v)}</div>`;
    };
    const one = x => `<li class="wk">${circle(x)}<div class="wk-c">`
      + x.b.map(y => `<div class="wk-b">${y.t ? `<p class="wk-t">${esc(y.t)}</p>` : ''}${y.d.map(d => `<p class="wk-d">${esc(d)}</p>`).join('')}${y.tool ? `<p class="wk-u">${esc(y.tool)}</p>` : ''}${y.out ? `<p class="wk-o"><b>결과물</b>${esc(y.out)}</p>` : ''}</div>`).join('')
      + `</div></li>`;
    const list = a => `<ol class="tl">${a.map(one).join('')}</ol>`;
    if (!isWeek) return list(weeks);
    return months(weeks).map(g => `<section class="mon"><h3 class="mon-h"><b>${g.m}달차</b>${g.t ? `<em>${esc(g.t)}</em>` : ''}</h3>${list(g.a)}</section>`).join('');
  }

  /* ── 화면 ── */
  let root = null, S = { line: null, row: 0 }, shots = [], lbAt = 0;
  const $ = id => root.getElementById(id);
  const isNarrow = () => matchMedia('(max-width: 680px), (max-height: 520px)').matches;
  const curRow = () => S.line.rows[S.row];

  function renderDepts() {
    let lastG = '', h = '';
    data.lines.forEach(l => {
      if (l.group !== lastG) { h += `<p class="grp">${GROUP[l.group] || ''}</p>`; lastG = l.group; }
      const n = l.rows.filter(r => !r.hub).length;
      h += `<button type="button" class="dept" data-id="${esc(l.id)}" style="--dc:${esc(l.color)}"${l === S.line ? ' aria-current="true"' : ''}><i></i><span>${esc(l.tab || l.name)}</span><em>${n}</em></button>`;
    });
    $('depts').innerHTML = h;
  }
  function courseBtn(r, i, label) {
    const mark = r.hub ? '<span class="hubm">2</span>' : `<span class="num num--${esc(r.t)}">${label}</span>`;
    const name = r.hub ? '공통기초 순환선' : r.name;
    const sub = r.hub ? '공통 과정 3개' : [r.parts ? `${r.parts.length}단계` : '', DAY[r.day] || ''].filter(Boolean).join(' · ');
    return `<li><button type="button" class="course" data-i="${i}"${i === S.row ? ' aria-current="true"' : ''}>`
      + `<span class="mark">${mark}</span><span>${esc(name)}${sub ? `<small${r.day === 'end' ? ' class="is-end"' : ''}>${esc(sub)}</small>` : ''}</span></button></li>`;
  }
  function renderCourses() {
    const l = S.line, own = l.rows.filter(r => !r.hub);
    let k = 0;
    $('courses').innerHTML = `<div class="c-head"><h2 class="c-title">${esc(l.name)}</h2><p class="c-meta">${l.solo ? '공통기초 없이 바로 시작 · ' : ''}과정 ${own.length}개</p></div>`
      + `<ol class="list">${l.rows.map((r, i) => courseBtn(r, i, r.hub ? '' : ++k)).join('')}</ol>`;
  }
  function renderDetail() {
    const l = S.line, r = curRow();
    $('text').style.setProperty('--c', l.color);
    if (r.hub) {
      const hub = data.lines[0];
      $('text').innerHTML = `<p class="d-crumb">${esc(l.name)}</p><h2 class="d-title">공통기초 순환선</h2><p class="d-desc">이 학과를 시작하기 전에 함께 듣는 공통 과정이에요.</p><div class="d-body">`
        + hub.rows.map((c, i) => `<button type="button" class="core" data-core="${i}"><span class="mark"><span class="num num--a" style="--c:#16a34a">${i + 1}</span></span><span><b>${esc(c.name)}</b><small>${esc(c.desc || '')}</small></span></button>`).join('') + `</div>`;
      renderImgs(hub.rows.flatMap(c => c.src || []).flatMap(k => (data.records[k] ? data.records[k].imgs : [])).slice(0, 8).map(u => ({ u })), false);
      return;
    }
    const rs = recs(r), textRs = rs.filter(x => x.items.length), badge = r.badge || (r.t === 'p' ? 'PO·완성' : '');
    const info = (rs.find(x => x.info) || {}).info;
    const infoHtml = info ? `<div class="af"><p class="af-sum">${esc(info.sum)}</p><div class="af-st">${info.stages.map(s => `<div><b>${esc(s[0])}</b><span>${esc(s[1])}</span><small>${esc(s[2])}</small></div>`).join('')}</div><p class="af-rule">${esc(info.rule)}</p></div>` : '';
    const body = textRs.length
      ? infoHtml + textRs.map(s => (textRs.length > 1 ? `<p class="sec-h">${esc(s.title)}</p>` : '') + weeksHtml(s.items)).join('')
      : `<p class="empty">커리큘럼을 준비하고 있어요.</p>`;
    $('text').innerHTML = `<p class="d-crumb">${esc(l.name)}</p><h2 class="d-title">${esc(r.name)}${badge ? `<span class="badge badge--${esc(r.t)}">${esc(badge)}</span>` : ''}</h2>`
      + (r.desc ? `<p class="d-desc">${esc(r.desc)}</p>` : '')
      + (r.parts ? `<ul class="parts">${r.parts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '')
      + (r.note ? `<p class="d-note">${esc(r.note)}</p>` : '')
      + (DAY[r.day] ? `<p class="d-run"><b>${esc(DAY[r.day])}</b>${r.wk ? ` · 주말 개강 ${esc(r.wk)}` : ''}</p>` : '')
      + `<div class="d-body">${body}</div>`;
    renderRowImgs(r);
  }
  function renderRowImgs(r) {
    let list = [];
    recs(r).forEach(x => x.imgs.forEach(u => list.push({ u })));
    if (r.pf && data.pf[r.pf]) list = data.pf[r.pf].map(u => (u.indexOf('youtube:') === 0 ? { yt: u.slice(8) } : { u })).concat(list);
    if (list.length) renderImgs(list.slice(0, 16), false);
    else if (r.stock) renderImgs(r.stock.map(s => ({ id: s[0], by: s[1] })), true);
    else renderImgs((S.line.ex || []).map(s => ({ f: s[0], by: s[1] })), true);
  }
  function renderImgs(list, isRef) {
    shots = list.map(x => (x.id ? `https://images.unsplash.com/photo-${x.id}?w=960&q=75&fm=webp` : x.f ? `/images/roadmap-ex/${x.f}` : x.yt ? small(`https://i.ytimg.com/vi/${x.yt}/hqdefault.jpg`) : small(x.u)));
    const body = list.map((x, i) => {
      const cap = x.by ? `<figcaption>참고 사진 · ${esc(x.by)} / Unsplash</figcaption>` : '';
      if (x.yt) return `<figure><a class="shot is-video" href="https://youtu.be/${encodeURIComponent(x.yt)}" target="_blank" rel="noopener" aria-label="영상 보기"><img src="${esc(shots[i])}" alt="" loading="lazy" decoding="async"></a></figure>`;
      return `<figure><button type="button" class="shot" data-shot="${i}" aria-label="이미지 크게 보기"><img src="${esc(shots[i])}" alt="" loading="lazy" decoding="async"></button>${cap}</figure>`;
    }).join('');
    $('imgs').innerHTML = `<h3 class="i-h">${isRef ? '참고 이미지' : '예시 이미지'}</h3>${isRef ? '<p class="i-sub">수강생 작품이 아닌 무료 참고 사진이에요</p>' : ''}`
      + (list.length ? `<div class="gal">${body}</div>` : `<p class="empty">이미지를 준비하고 있어요.</p>`);
    $('imgs').scrollTop = 0;
  }
  function fades() { [$('depts'), $('courses')].forEach(el => el && el.classList.toggle('more', el.scrollHeight - el.clientHeight - el.scrollTop > 4)); }
  function topTitle() {
    const st = +$('app').dataset.step, r = curRow();
    $('topT').textContent = st === 1 ? '학과를 골라 주세요' : st === 2 ? S.line.name : (r.hub ? '공통기초 순환선' : r.name);
  }
  function render(step) {
    const a = $('app'), l = S.line;
    a.style.setProperty('--c', l.color); a.style.setProperty('--ci', l.ink || l.color); a.style.setProperty('--tint', l.color + '16');
    renderDepts(); renderCourses(); renderDetail();
    $('text').scrollTop = 0;
    if (step) { a.dataset.step = step; root.querySelector('.cols').scrollTop = 0; }
    topTitle(); fades();
  }
  function openLb(i) { lbAt = (i + shots.length) % shots.length; $('lb-img').src = shots[lbAt]; $('lb').hidden = false; $('lb-x').focus(); }
  function closeLb() { $('lb').hidden = true; $('lb-img').removeAttribute('src'); }

  function build(host) {
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<link rel="stylesheet" href="/curriculum/cx.css">
      <div class="app" id="app" data-step="1">
        <header class="top"><button type="button" class="back" id="back" aria-label="이전 단계">‹</button><p class="top-t" id="topT"></p>
          <ul class="legend" aria-label="역 표시">${LEGEND.map(([t, n]) => `<li><i class="lg lg--${t}"></i>${n}</li>`).join('')}</ul></header>
        <div class="cols" id="cols">
          <nav class="col c-dept" id="depts" aria-label="학과"></nav>
          <section class="col c-course" id="courses" aria-label="과정"></section>
          <article class="col c-text" id="text"></article>
          <aside class="col c-imgs" id="imgs" aria-label="예시 이미지"></aside>
        </div>
      </div>
      <div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="이미지 크게 보기">
        <img id="lb-img" alt="">
        <button type="button" class="lb-x" id="lb-x" aria-label="닫기">×</button>
        <button type="button" class="lb-p" id="lb-p" aria-label="이전 이미지">‹</button>
        <button type="button" class="lb-n" id="lb-n" aria-label="다음 이미지">›</button>
      </div>`;
    $('depts').addEventListener('click', e => {
      const b = e.target.closest('.dept'); if (!b) return;
      S.line = lineById(b.dataset.id); S.row = firstRow(S.line);
      render(isNarrow() ? 2 : 0); $('courses').scrollTop = 0; fades();
    });
    $('courses').addEventListener('click', e => {
      const b = e.target.closest('.course'); if (!b) return;
      S.row = +b.dataset.i; render(isNarrow() ? 3 : 0);
    });
    $('text').addEventListener('click', e => {
      const c = e.target.closest('.core'); if (!c) return;
      S.line = data.lines[0]; S.row = +c.dataset.core; render(isNarrow() ? 3 : 0);
    });
    $('back').addEventListener('click', () => { const a = $('app'); a.dataset.step = Math.max(1, +a.dataset.step - 1); render(); $('cols').scrollTop = 0; });
    $('imgs').addEventListener('click', e => { const b = e.target.closest('[data-shot]'); if (b) openLb(+b.dataset.shot); });
    $('lb-x').addEventListener('click', closeLb);
    $('lb-p').addEventListener('click', () => openLb(lbAt - 1));
    $('lb-n').addEventListener('click', () => openLb(lbAt + 1));
    $('lb').addEventListener('click', e => { if (e.target === $('lb')) closeLb(); });
    document.addEventListener('keydown', e => {
      if (!root || $('lb').hidden) return;
      if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowLeft') openLb(lbAt - 1); else if (e.key === 'ArrowRight') openLb(lbAt + 1);
    });
    [$('depts'), $('courses')].forEach(el => el.addEventListener('scroll', fades, { passive: true }));
    window.addEventListener('resize', () => { if (S.line) fades(); });
  }
  function showMsg(text, retry) {
    $('cols').innerHTML = `<div class="cx-msg"><div>${esc(text)}${retry ? '<br><button type="button" id="cxRetry">다시 불러오기</button>' : ''}</div></div>`;
    if (retry) $('cxRetry').addEventListener('click', () => location.reload());
  }
  function mount() {
    const host = document.getElementById('cx-host');
    if (!host || host.shadowRoot) return;
    build(host);
    load().then(() => {
      S.line = data.lines.find(l => l.group === 'main') || data.lines[0]; S.row = firstRow(S.line);
      render(1);
    }).catch(() => showMsg('커리큘럼을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.', true));
  }

  /* ── PDF용: 한 학과의 커리큘럼을 A4 세로 블록들로(사이트 스타일 .pcx-*) ── */
  function printBlocks(lineId) {
    const l = lineById(lineId); if (!l) return null;
    const own = l.rows.filter(r => !r.hub);
    const head = `<div class="pdf-curr__head"><p class="pdf-curr__org">${esc(ORG)}</p><p class="pdf-curr__title">${esc(l.name)} 커리큘럼</p>`
      + `<p class="pdf-curr__meta">${l.rows.some(r => r.hub) ? '공통기초 → ' : ''}${own.map(r => esc(r.name)).join(' → ')}</p></div>`;
    const blocks = [head];
    if (l.rows.some(r => r.hub)) {
      blocks.push(`<section class="pcx" style="--c:#16a34a"><h2 class="pcx-h"><span class="pcx-num">2</span>공통기초 순환선</h2><p class="pcx-meta">학과 과정을 시작하기 전에 함께 듣는 공통 과정</p>`
        + `<ul class="pcx-core">${data.lines[0].rows.map(c => `<li><b>${esc(c.name)}</b>${c.desc ? ` · ${esc(c.desc)}` : ''}</li>`).join('')}</ul></section>`);
    }
    own.forEach((r, i) => {
      const rs = recs(r).filter(x => x.items.length), badge = r.badge || (r.t === 'p' ? 'PO·완성' : '');
      const meta = [r.desc, r.parts ? r.parts.join(' · ') : '', DAY[r.day] || ''].filter(Boolean).map(esc).join(' · ');
      const weeks = rs.map(s => {
        const ws = parseItems(s.items), isWeek = isWeekList(ws);
        const row = x => `<div class="pcx-wk"><b class="pcx-tag">${esc(isWeek ? inMonth(x) + 'week' : x.n)}</b><div class="pcx-wc">`
          + x.b.map(y => `${y.t ? `<p class="pcx-t">${esc(y.t)}</p>` : ''}${y.d.map(d => `<p class="pcx-d">${esc(d)}</p>`).join('')}${y.out ? `<p class="pcx-o">결과물 · ${esc(y.out)}</p>` : ''}`).join('') + `</div></div>`;
        const body = isWeek ? months(ws).map(g => `<p class="pcx-mon">${g.m}달차${g.t ? ` · ${esc(g.t)}` : ''}</p>${g.a.map(row).join('')}`).join('') : ws.map(row).join('');
        return (rs.length > 1 ? `<p class="pcx-sub">${esc(s.title)}</p>` : '') + body;
      }).join('');
      blocks.push(`<section class="pcx" style="--c:${esc(l.color)}"><h2 class="pcx-h"><span class="pcx-num">${i + 1}</span>${esc(r.name)}${badge ? `<span class="pcx-badge">${esc(badge)}</span>` : ''}</h2>`
        + (meta ? `<p class="pcx-meta">${meta}</p>` : '') + (weeks || '<p class="pcx-d">커리큘럼을 준비하고 있어요.</p>') + `</section>`);
    });
    return { title: l.name, blocks };
  }
  // PDF 포트폴리오: 학과 포트폴리오(수강생 작품) → 없으면 과정별 예시 이미지, 중복 없이 최대 24장
  function pfItems(lineId) {
    const l = lineById(lineId); if (!l) return [];
    const seen = new Set(), out = [];
    const add = u => { if (u && !seen.has(u)) { seen.add(u); out.push(u); } };
    l.rows.forEach(r => { if (r.pf && data.pf[r.pf]) data.pf[r.pf].forEach(add); });
    if (!out.length) l.rows.filter(r => !r.hub).forEach(r => recs(r).forEach(x => x.imgs.forEach(add)));
    return out.slice(0, 24);
  }

  window.CX = {
    load,
    line: () => (S.line && root && document.getElementById('page-curriculum')?.classList.contains('is-active') ? S.line.id : null),
    lineName: id => { const l = lineById(id); return l ? l.name : ''; },
    printBlocks, pfItems,
  };
  if (!/[?&]pdf=/.test(location.search)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  }
})();
