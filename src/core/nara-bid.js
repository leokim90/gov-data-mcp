// --- 나라장터 입찰공고정보서비스 ---
// endpoint: apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfo{type}
// type: Servc(용역) | Cnstwk(공사) | Thng(물품) | Frgcpt(외자)
import { formatDate, fetchWithTimeout } from './utils.js';

// Date 객체를 나라장터 조회 파라미터 형식(YYYYMMDDHHMM)으로 변환
function toInqryDt(date) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `${p(date.getHours())}${p(date.getMinutes())}`
  );
}

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

  // 나라장터 API 필수 파라미터: inqryDiv(조회구분=공고게시일시) + 조회기간
  // 미설정 시 "필수값 입력 에러"로 조용히 빈 배열이 반환되므로 기본값을 채운다
  url.searchParams.set('inqryDiv', '1');

  // 조회기간 기본값: 최근 30일 ~ 현재 (호출자가 명시하면 그 값 사용)
  if (!inqryBgnDt || !inqryEndDt) {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    inqryBgnDt = inqryBgnDt || toInqryDt(from);
    inqryEndDt = inqryEndDt || toInqryDt(now);
  }
  url.searchParams.set('inqryBgnDt', inqryBgnDt);
  url.searchParams.set('inqryEndDt', inqryEndDt);

  // 공고명 키워드 검색
  if (keyword) url.searchParams.set('bidNtceNm', keyword);

  try {
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) {
      return { items: [], totalCount: 0, error: `나라장터 API HTTP ${res.status}` };
    }
    const json = await res.json();

    // 에러 응답 감지: 정상은 resultCode '00'. 그 외(필수값 누락 등)는
    // 조용히 빈 배열로 삼키지 않고 warning으로 표면화한다 (graceful 계약)
    const header =
      json?.response?.header || json?.['nkoneps.com.response.ResponseError']?.header;
    if (header && header.resultCode && header.resultCode !== '00') {
      return {
        items: [],
        totalCount: 0,
        warning: `나라장터 API 응답 코드 [${header.resultCode}] ${header.resultMsg || ''}`.trim(),
      };
    }

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
