// --- 기업마당 (bizinfo.go.kr) 지원사업정보 API ---
// NIPA, KISA, 중진공, TIPA 등 전 산하기관 통합 공고를 RSS 형식으로 반환
import { extractTag, stripHtml } from './utils.js';

// 기업마당 지원사업 조회
export async function fetchBizinfoPrograms({ searchCnt = 20 } = {}) {
  const key = process.env.BIZINFO_API_KEY;
  if (!key) {
    return { items: [], warning: 'BIZINFO_API_KEY 미설정' };
  }

  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${key}&dataType=rss&searchCnt=${searchCnt}`;

  try {
    const res = await fetch(url);
    const xml = await res.text();

    // 인증 실패 등 에러 응답 차단
    if (xml.includes('reqErr')) {
      const errMsg = xml.match(/"reqErr":"([^"]+)"/)?.[1] || xml.slice(0, 200);
      return { items: [], error: `기업마당 API 에러: ${errMsg}` };
    }

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const c = match[1];
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
        hashtags: extractTag(c, 'hashtags'),
      });
    }
    return { items };
  } catch (err) {
    return { items: [], error: `기업마당 API 실패: ${err.message}` };
  }
}
