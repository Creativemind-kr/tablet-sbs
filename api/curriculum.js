// 커리큘럼 탭 내용: 커리큘럼 수정 페이지(구글 앱스 스크립트)에서 받아 옴 — 강사가 고치는 대로 반영
// - Vercel 서버가 3분 동안 받아 둔 내용을 주고, 그 뒤 첫 요청 때 새로 받아 옴(그동안은 받아 둔 내용을 계속 줌)
// - 받아 오지 못하면 502 → 화면은 예비본 /curriculum/data.json 으로 보여줌
const { transform, GAS_SITE_URL } = require('./_cx_transform.js');

module.exports = async (req, res) => {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 20000);
    const r = await fetch(GAS_SITE_URL, { redirect: 'follow', signal: c.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('수정 페이지 응답 ' + r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.lines) || !d.records) throw new Error('내용 형식이 다름');
    res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=86400');
    return res.status(200).json(transform(d));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ok: false, error: String((e && e.message) || e) });
  }
};
