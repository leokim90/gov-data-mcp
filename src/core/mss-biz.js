// --- 중소벤처기업부 사업공고 API ---
// endpoint: apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2
import { extractTag, stripHtml, formatDate, fetchWithTimeout } from './utils.js';

// 중기부 사업공고 목록 조회 (XML 응답 → JSON 정규화)
export async function fetchMssBizList({ numOfRows = 20, pageNo = 1 } = {}) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    return { items: [], totalCount: 0, warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
  }

  const url = new URL('https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2');
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('pageNo', String(pageNo));

  try {
    const res = await fetchWithTimeout(url.toString());
    const xml = await res.text();

    // 전체 건수 추출
    const totalCount = parseInt(extractTag(xml, 'totalCount') || '0', 10);

    // XML에서 <item> 블록 추출 → 정규화
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      items.push({
        itemId: extractTag(content, 'itemId'),
        title: extractTag(content, 'title'),
        viewUrl: extractTag(content, 'viewUrl'),
        applicationStartDate: formatDate(extractTag(content, 'applicationStartDate')),
        applicationEndDate: formatDate(extractTag(content, 'applicationEndDate')),
        writerName: extractTag(content, 'writerName'),
        writerPosition: extractTag(content, 'writerPosition'),
        writerPhone: extractTag(content, 'writerPhone'),
        writerEmail: extractTag(content, 'writerEmail'),
        fileName: extractTag(content, 'fileName'),
        fileUrl: extractTag(content, 'fileUrl'),
        dataContents: stripHtml(extractTag(content, 'dataContents')).slice(0, 500),
      });
    }
    return { items, totalCount, pageNo, numOfRows };
  } catch (err) {
    return { items: [], totalCount: 0, error: `중기부 사업공고 API 실패: ${err.message}` };
  }
}
