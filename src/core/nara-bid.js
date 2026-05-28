// --- 나라장터 입찰공고정보서비스 ---
// endpoint: apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfo{type}
// type: Servc(용역) | Cnstwk(공사) | Thng(물품) | Frgcpt(외자)
import { formatDate, fetchWithTimeout } from './utils.js';

// 나라장터 입찰공고 조회 (기본: 용역)
export async function fetchNaraBidList({
  numOfRows = 20,
  pageNo = 1,
  type = 'Servc',
  keyword,
  inqryBgnDt,
  inqryEndDt,
} = {}) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    return { items: [], totalCount: 0, warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
  }

  const endpoint = `https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfo${type}`;
  const url = new URL(endpoint);
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('type', 'json');

  // 공고명 키워드 검색
  if (keyword) url.searchParams.set('bidNtceNm', keyword);
  if (inqryBgnDt) url.searchParams.set('inqryBgnDt', inqryBgnDt);
  if (inqryEndDt) url.searchParams.set('inqryEndDt', inqryEndDt);

  try {
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      return { items: [], totalCount: 0, error: `나라장터 API HTTP ${res.status}` };
    }
    const json = await res.json();

    const totalCount = parseInt(json?.response?.body?.totalCount || '0', 10);
    const rawItems = json?.response?.body?.items || [];
    if (!Array.isArray(rawItems)) return { items: [], totalCount: 0 };

    const items = rawItems.map((item) => ({
      bidNtceNo: item.bidNtceNo || '',
      bidNtceNm: item.bidNtceNm || '',
      ntceInsttNm: item.ntceInsttNm || '',
      dminsttNm: item.dminsttNm || '',
      bidNtceDt: formatDate(item.bidNtceDt || ''),
      bidClseDt: formatDate(item.bidClseDt || ''),
      presmptPrce: item.presmptPrce || '',
      bidNtceDtlUrl: item.bidNtceDtlUrl || '',
      ntceKindNm: item.ntceKindNm || '',
      cntrctMthdNm: item.cntrctMthdNm || '',
      bidQlfctRgstDt: formatDate(item.bidQlfctRgstDt || ''),
      rbidPermsnYn: item.rbidPermsnYn || '',
    }));
    return { items, totalCount, pageNo, numOfRows };
  } catch (err) {
    return { items: [], totalCount: 0, error: `나라장터 입찰공고 API 실패: ${err.message}` };
  }
}
