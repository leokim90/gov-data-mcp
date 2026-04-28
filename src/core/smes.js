// --- 중소벤처24 (smes.go.kr) 민간공고목록정보 API ---
// NIPA, KISA, 중진공, TIPA 등 산하기관 공고 포함
import { stripHtml } from './utils.js';

// 중소벤처24 공고 목록 조회
export async function fetchSmesNoticeList({ numOfRows = 20, pageNo = 1 } = {}) {
  const key = process.env.SMES_API_KEY;
  if (!key) {
    return { items: [], warning: 'SMES_API_KEY 미설정' };
  }

  const url = new URL('https://www.smes.go.kr/fnct/apiReqst/extPblancInfo');
  url.searchParams.set('token', key);
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('dataType', 'json');

  try {
    const res = await fetch(url.toString());
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { items: [], error: '중소벤처24 응답 파싱 실패' };
    }

    const rawItems = data?.data || data?.body?.items || data?.items || [];
    if (!Array.isArray(rawItems)) {
      return {
        items: [],
        warning: `중소벤처24 응답 구조 확인 필요: ${text.slice(0, 300)}`,
      };
    }

    // 마감일이 지난 공고는 제외 (오늘 기준)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = rawItems
      .filter((item) => {
        const endDate = item.pblancEndDt ? new Date(item.pblancEndDt) : null;
        return !endDate || endDate >= today;
      })
      .map((item) => ({
        title: item.pblancNm || '',
        agency: item.sportInsttNm || '',
        applyStart: item.pblancBgnDt || '',
        applyEnd: item.pblancEndDt || '',
        description: stripHtml(item.policyCnts || ''),
        target: stripHtml(item.sportTrget || ''),
        supportAmount: stripHtml(item.sportMg || ''),
        supportContent: stripHtml(item.sportCnts || ''),
        applyMethod: stripHtml(item.reqstRcept || ''),
        noticeUrl: item.pblancDtlUrl || '',
        category: item.bizType || '',
        bizTypeCd: item.bizTypeCd || '',
        attachments: item.pblancAttachNm || '',
      }));

    return { items };
  } catch (err) {
    return { items: [], error: `중소벤처24 API 실패: ${err.message}` };
  }
}
