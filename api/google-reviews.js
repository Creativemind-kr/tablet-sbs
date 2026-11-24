// 구글 지도 후기(장소 API, Places API New)
// - 구글 약관상 후기를 저장해 둘 수 없어서, 수강생 후기 화면을 열 때마다 구글에서 새로 받아옴
// - 구글이 주는 후기는 최대 5개이며, 그중 4점 이상만 돌려줌
// - 키는 Vercel 환경변수 GOOGLE_PLACES_KEY (장소 API 전용 키, 하루 호출 상한 30회)
const PLACE_ID = 'ChIJldkiGKcnezURmNZJ-HcvQtE'; // 천안컴퓨터학원-SBS아카데미컴퓨터AIX학원 (장소 ID는 저장 허용)
const MIN_RATING = 4;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) return res.status(503).json({ ok: false, error: 'not_configured' });
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=ko&regionCode=KR`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'displayName,rating,userRatingCount,googleMapsUri,reviews' },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ ok: false, error: (d.error && d.error.status) || String(r.status) });
    const reviews = (d.reviews || [])
      .filter(v => (v.rating || 0) >= MIN_RATING)
      .map(v => {
        const a = v.authorAttribution || {};
        return {
          rating: v.rating,
          text: ((v.originalText || v.text || {}).text || '').trim(),
          when: v.relativePublishTimeDescription || '',
          time: v.publishTime || '',
          author: a.displayName || '',
          authorUri: a.uri || '',
          photo: a.photoUri || '',
          uri: v.googleMapsUri || '',
        };
      });
    return res.status(200).json({
      ok: true,
      name: (d.displayName && d.displayName.text) || '',
      rating: d.rating || null,
      count: d.userRatingCount || 0,
      mapsUri: d.googleMapsUri || '',
      reviews,
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};
