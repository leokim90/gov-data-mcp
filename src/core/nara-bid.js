// --- 나라장터 입찰공고정보서비스 ---
// endpoint: apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfo{type}
// type: Servc(용역) | Cnstwk(공사) | Thng(물품) | Frgcpt(외자)

// 나라장터 입찰공고 조회 (기본: 용역)
export async function fetchNaraBidList({
  numOfRows = 20,
  pageNo = 1,
  type = 'Servc',
  inqryBgnDt,
  inqryEndDt,
} = {}) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    return { items: [], warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
  }

  const endpoint = `https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfo${type}`;
  const url = new URL(endpoint);
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('type', 'json');

  if (inqryBgnDt) url.searchParams.set('inqryBgnDt', inqryBgnDt);
  if (inqryEndDt) url.searchParams.set('inqryEndDt', inqryEndDt);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      return { items: [], error: `나라장터 API HTTP ${res.status}` };
    }
    const json = await res.json();

    const items = json?.response?.body?.items || [];
    if (!Array.isArray(items)) return { items: [] };

    const normalized = items.map((item) => ({
      bidNtceNo: item.bidNtceNo || '',
      bidNtceNm: item.bidNtceNm || '',
      ntceInsttNm: item.ntceInsttNm || '',
      dminsttNm: item.dminsttNm || '',
      bidNtceDt: item.bidNtceDt || '',
      bidClseDt: item.bidClseDt || '',
      presmptPrce: item.presmptPrce || '',
      bidNtceDtlUrl: item.bidNtceDtlUrl || '',
      ntceKindNm: item.ntceKindNm || '',
      cntrctMthdNm: item.cntrctMthdNm || '',
      bidQlfctRgstDt: item.bidQlfctRgstDt || '',
      rbidPermsnYn: item.rbidPermsnYn || '',
    }));
    return { items: normalized };
  } catch (err) {
    return { items: [], error: `나라장터 입찰공고 API 실패: ${err.message}` };
  }
}
