// --- 정부24 공공서비스(혜택) 정보 API ---
// endpoint: api.odcloud.kr/api/gov24/v3/serviceList | serviceDetail
import { fetchWithTimeout } from './utils.js';

// odcloud API의 cond[] 파라미터는 URL 인코딩 없이 raw로 붙여야 동작하는 경우가 있어
// URL 객체 대신 문자열로 직접 조합
function buildOdcloudUrl(base, params) {
  const parts = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base}?${parts}`;
}

// 공공서비스 목록 조회 (키워드 LIKE 검색)
export async function fetchGov24ServiceList({ page = 1, perPage = 20, keyword = '' } = {}) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    return { items: [], totalCount: 0, warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
  }

  const params = {
    page: String(page),
    perPage: String(perPage),
    serviceKey: key,
  };

  // 키워드가 있으면 서비스명 부분일치 필터 추가
  if (keyword) {
    params['cond[서비스명::LIKE]'] = keyword;
  }

  const url = buildOdcloudUrl('https://api.odcloud.kr/api/gov24/v3/serviceList', params);

  try {
    const res = await fetchWithTimeout(url);
    const json = await res.json();

    if (!json.data) {
      return {
        items: [],
        totalCount: 0,
        warning: `공공서비스 API 응답 이상: ${JSON.stringify(json).slice(0, 200)}`,
      };
    }

    const totalCount = json.totalCount || json.data.length;

    // 한글 필드 → camelCase 정규화
    const items = json.data.map((item) => ({
      serviceId: item['서비스ID'] || '',
      serviceName: item['서비스명'] || '',
      serviceCategory: item['서비스분야'] || '',
      targetGroup: item['사용자구분'] || '',
      agency: item['소관기관명'] || '',
      purpose: item['서비스목적요약'] || '',
      supportContent: item['지원내용'] || '',
      applyMethod: item['신청방법'] || '',
      applyUrl: item['온라인신청사이트URL'] || '',
      selectionCriteria: item['선정기준'] || '',
      contactInfo: item['문의처전화번호'] || '',
      lastModified: item['수정일시'] || '',
    }));
    return { items, totalCount, page, perPage };
  } catch (err) {
    return { items: [], totalCount: 0, error: `공공서비스(혜택) API 실패: ${err.message}` };
  }
}

// 공공서비스 상세 조회 (serviceId 기반)
export async function fetchGov24ServiceDetail({ serviceId } = {}) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    return { item: null, warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
  }
  if (!serviceId) {
    return { item: null, warning: 'serviceId가 필요합니다' };
  }

  const params = {
    serviceKey: key,
    'cond[서비스ID::EQ]': serviceId,
  };

  const url = buildOdcloudUrl('https://api.odcloud.kr/api/gov24/v3/serviceDetail', params);

  try {
    const res = await fetchWithTimeout(url);
    const json = await res.json();
    const item = json.data?.[0] || null;
    return { item };
  } catch (err) {
    return { item: null, error: `공공서비스 상세 API 실패 (${serviceId}): ${err.message}` };
  }
}
