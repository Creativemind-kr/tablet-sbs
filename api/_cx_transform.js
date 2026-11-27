// 커리큘럼 수정 페이지 내용(?site=1) → 태블릿 사이트 커리큘럼 탭 데이터
// api/curriculum.js(3분마다 자동)와 tools/snapshot_curriculum.mjs(예비본 curriculum/data.json)가 같이 씀
const GAS_SITE_URL = 'https://script.google.com/macros/s/AKfycbw7Sz2qMarWhGdmZ1G-9zlaUSRZOTG_o1UlFNaFCRpfN5De78arjCYS2Yvv9HfZYm0/exec?site=1';
const KEEP_LINE = ['id', 'name', 'tab', 'color', 'ink', 'group', 'solo', 'ex'];
const KEEP_ROW = ['name', 't', 'src', 'parts', 'day', 'wk', 'badge', 'note', 'desc', 'hub', 'pf', 'stock'];
const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

// 시각편집은 로드맵 순서로(11/27): 그래픽아트웍 → 브랜딩디자인 → 인디자인 → 컴퓨터그래픽기능사 → AI시각디자인 → AI편집포폴 → AI디자인수익화
// 수정 페이지가 이미 새 순서로 바뀌어 있으면 손대지 않음
function fixL3(line, lines) {
  const by = {};
  line.rows.forEach(r => { if (!r.hub && r.name) by[r.name] = r; });
  const OLD = ['AI그래픽아트웍', 'AI브랜딩디자인', '인디자인'];
  if (!OLD.every(n => by[n])) return;
  const l9 = lines.find(l => l.id === 'l9');
  const cert = l9 && l9.rows.find(r => r.name === '국가기술자격증');
  const hub = line.rows.filter(r => r.hub);
  const rest = line.rows.filter(r => !r.hub && OLD.indexOf(r.name) < 0);
  const cg = rest.some(r => r.name === '컴퓨터그래픽기능사') ? [] : [{
    name: '컴퓨터그래픽기능사', t: 'g', desc: '국가기술자격 실기 대비',
    day: cert && cert.day, wk: cert && cert.wk, src: ['d01|컴퓨터그래픽기능사'],
  }];
  line.rows = hub.concat(
    [Object.assign({}, by['AI그래픽아트웍'], { name: '그래픽아트웍', t: 'g', desc: '비주얼 합성 · 아트웍 심화' }),
      Object.assign({}, by['AI브랜딩디자인'], { name: '브랜딩디자인', t: 'g' }),
      by['인디자인']],
    cg, rest);
}

function transform(d) {
  const src = JSON.parse(JSON.stringify(d));
  const lines = src.lines.map(l => {
    if (l.id === 'l3') fixL3(l, src.lines);
    const nl = {};
    KEEP_LINE.forEach(k => { if (!empty(l[k])) nl[k] = l[k]; });
    nl.rows = (l.rows || []).map(r => {
      const o = {};
      KEEP_ROW.forEach(k => { if (!empty(r[k])) o[k] = r[k]; });
      if (['both', 'week', 'end'].indexOf(o.day) < 0) delete o.day;   // 신설 예정·시수 조정 중 같은 내부 표시는 안 보임
      return o;
    });
    return nl;
  });
  const used = new Set(lines.flatMap(l => l.rows.flatMap(r => r.src || [])));
  const records = {};
  Array.from(used).sort().forEach(k => {
    const r = src.records[k];
    if (!r) return;
    const o = { title: r.title, items: r.items || [], imgs: (r.imgs || []).filter(u => /^https:\/\//.test(u)) };
    if (r.info) o.info = r.info;
    records[k] = o;
  });
  const pf = {};
  Object.keys(src.pf || {}).forEach(k => { if (lines.some(l => l.rows.some(r => r.pf === k))) pf[k] = src.pf[k]; });
  return { lines, records, pf };
}

module.exports = { transform, GAS_SITE_URL };
