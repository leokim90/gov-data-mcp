// --- 중소벤처24 (smes.go.kr) 민간공고목록정보 API ---
// NIPA, KISA, 중진공, TIPA 등 산하기관 공고 포함
import { stripHtml, formatDate, fetchWithTimeout } from './utils.js';

// 중소벤처24 공고 목록 조회
export async function fetchSmesNoticeList({ numOfRows = 20, pageNo = 1 } = {}) {
  const key = process.env.SMES_API_KEY;
  if (!key) {
    return { items: [], totalCount: 0, warning: 'SMES_API_KEY 미설정' };
  }

  const url = new URL('https://www.smes.go.kr/fnct/apiReqst/extPblancInfo');
  url.searchParams.set('token', key);
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('dataType', 'json');

  try {
    const res = await fetchWithTimeout(url.toString());
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { items: [], totalCount: 0, error: `중소벤처24 응답 파싱 실패: ${text.slice(0, 200)}` };
    }

    // 여러 응답 구조 대응 (API 버전별 경로 차이)
    const rawItems =
      (Array.isArray(data?.data) && data.data) ||
      (Array.isArray(data?.body?.items) && data.body.items) ||
      (Array.isArray(data?.items) && data.items) ||
      null;

    if (!rawItems) {
      return {
        items: [],
        totalCount: 0,
        warning: `중소벤처24 응답 구조 확인 필요: ${text.slice(0, 300)}`,
      };
    }

    const totalCount = parseInt(
      data?.totalCount || data?.body?.totalCount || rawItems.length,
      10,
    );

    // 마감일이 지난 공고는 제외 (오늘 기준)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = rawItems
      .filter((item) => {
        // 마감일이 없으면 통과 (상시 모집 등)
        if (!item.pblancEndDt) return true;
        const endDate = new Date(item.pblancEndDt);
        // 날짜 파싱 실패("상시", "예산 소진 시까지" 등)는 통과 — API 형식 신뢰
        if (Number.isNaN(endDate.getTime())) return true;
        return endDate >= today;
      })
      .map((item) => ({
        title: item.pblancNm || '',
        agency: item.sportInsttNm || '',
        applyStart: formatDate(item.pblancBgnDt || ''),
        applyEnd: formatDate(item.pblancEndDt || ''),
        description: stripHtml(item.policyCnts || '').slice(0, 500),
        target: stripHtml(item.sportTrget || ''),
        supportAmount: stripHtml(item.sportMg || ''),
        supportContent: stripHtml(item.sportCnts || ''),
        applyMethod: stripHtml(item.reqstRcept || ''),
        noticeUrl: item.pblancDtlUrl || '',
        category: item.bizType || '',
        bizTypeCd: item.bizTypeCd || '',
        attachments: item.pblancAttachNm || '',
      }));

    return { items, totalCount, pageNo, numOfRows };
  } catch (err) {
    return { items: [], totalCount: 0, error: `중소벤처24 API 실패: ${err.message}` };
  }
}
