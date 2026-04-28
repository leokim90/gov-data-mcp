// --- 중소벤처기업부 사업공고 API ---
// endpoint: apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2
import { extractTag } from './utils.js';

// 중기부 사업공고 목록 조회 (XML 응답 → JSON 정규화)
export async function fetchMssBizList({ numOfRows = 20, pageNo = 1 } = {}) {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    return { items: [], warning: 'DATA_GO_KR_SERVICE_KEY 미설정' };
  }

  const url = new URL('https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2');
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('numOfRows', String(numOfRows));
  url.searchParams.set('pageNo', String(pageNo));

  try {
    const res = await fetch(url.toString());
    const xml = await res.text();

    // XML에서 <item> 블록 추출 → 정규화
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      items.push({
        title: extractTag(content, 'title'),
        viewUrl: extractTag(content, 'viewUrl'),
        applicationStartDate: extractTag(content, 'applicationStartDate'),
        applicationEndDate: extractTag(content, 'applicationEndDate'),
        writerName: extractTag(content, 'writerName'),
        writerPosition: extractTag(content, 'writerPosition'),
        writerPhone: extractTag(content, 'writerPhone'),
        writerEmail: extractTag(content, 'writerEmail'),
        fileName: extractTag(content, 'fileName'),
        fileUrl: extractTag(content, 'fileUrl'),
        dataContents: extractTag(content, 'dataContents')?.replace(/<[^>]+>/g, '').slice(0, 500),
        itemId: extractTag(content, 'itemId'),
      });
    }
    return { items };
  } catch (err) {
    return { items: [], error: `중기부 사업공고 API 실패: ${err.message}` };
  }
}
