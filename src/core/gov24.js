// --- 정부24 공공서비스(혜택) 정보 API ---
// endpoint: api.odcloud.kr/api/gov24/v3/serviceList | serviceDetail

// 공공서비스 목록 조회 (키워드 LIKE 검색)
export async function fetchGov24ServiceList({ page = 1, perPage = 20, keyword = '' } = {}) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    return { items: [], warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
  }

  const url = new URL('https://api.odcloud.kr/api/gov24/v3/serviceList');
  url.searchParams.set('page', String(page));
  url.searchParams.set('perPage', String(perPage));
  url.searchParams.set('serviceKey', key);

  // 키워드가 있으면 서비스명 부분일치 필터 적용
  if (keyword) {
    url.searchParams.set('cond[서비스명::LIKE]', keyword);
  }

  try {
    const res = await fetch(url.toString());
    const json = await res.json();

    if (!json.data) {
      return {
        items: [],
        warning: `공공서비스 API 응답 이상: ${JSON.stringify(json).slice(0, 200)}`,
      };
    }

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
    return { items };
  } catch (err) {
    return { items: [], error: `공공서비스(혜택) API 실패: ${err.message}` };
  }
}

// 공공서비스 상세 조회 (serviceId 기반)
export async function fetchGov24ServiceDetail(serviceId) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key || !serviceId) return null;

  const url = new URL('https://api.odcloud.kr/api/gov24/v3/serviceDetail');
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('cond[서비스ID::EQ]', serviceId);

  try {
    const res = await fetch(url.toString());
    const json = await res.json();
    return json.data?.[0] || null;
  } catch (err) {
    return { error: `공공서비스 상세 API 실패 (${serviceId}): ${err.message}` };
  }
}
