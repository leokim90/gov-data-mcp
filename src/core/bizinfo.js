// --- 기업마당 (bizinfo.go.kr) 지원사업정보 API ---
// NIPA, KISA, 중진공, TIPA 등 전 산하기관 통합 공고를 RSS 형식으로 반환
import { extractTag, stripHtml, fetchWithTimeout } from './utils.js';

// 기업마당 지원사업 조회
export async function fetchBizinfoPrograms({ searchCnt = 20 } = {}) {
  const key = process.env.BIZINFO_API_KEY;
  if (!key) {
    return { items: [], totalCount: 0, warning: 'BIZINFO_API_KEY 미설정' };
  }

  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${encodeURIComponent(key)}&dataType=rss&searchCnt=${searchCnt}`;

  try {
    const res = await fetchWithTimeout(url);
    const xml = await res.text();

    // JSON 에러 응답 감지 (인증 실패 등)
    if (xml.trimStart().startsWith('{')) {
      let parsed;
      try {
        parsed = JSON.parse(xml);
      } catch {
        // JSON이 아니면 그냥 계속
      }
      if (parsed) {
        const errMsg = parsed.reqErr || parsed.message || JSON.stringify(parsed).slice(0, 200);
        return { items: [], totalCount: 0, error: `기업마당 API 에러: ${errMsg}` };
      }
    }

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const c = match[1];
      // 해시태그는 쉼표 구분 문자열 → 배열로 변환
      const hashtagRaw = extractTag(c, 'hashtags');
      const hashtags = hashtagRaw
        ? hashtagRaw.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
        : [];

      items.push({
        title: extractTag(c, 'pblancNm') || extractTag(c, 'title'),
        agency: extractTag(c, 'author'),
        executor: extractTag(c, 'excInsttNm'),
        description: stripHtml(extractTag(c, 'description')).slice(0, 500),
        category: extractTag(c, 'lcategory'),
        pubDate: extractTag(c, 'pubDate'),
        applyPeriod: extractTag(c, 'reqstDt'),
        target: extractTag(c, 'trgetNm'),
        noticeUrl: extractTag(c, 'pblancUrl') || extractTag(c, 'link'),
        fileUrl: extractTag(c, 'flpthNm'),
        fileName: extractTag(c, 'fileNm'),
        hashtags,
      });
    }
    return { items, totalCount: items.length };
  } catch (err) {
    return { items: [], totalCount: 0, error: `기업마당 API 실패: ${err.message}` };
  }
}
