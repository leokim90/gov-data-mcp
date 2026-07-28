// --- 파싱 로직 유닛 테스트 (node:test 내장 모듈만 사용) ---
// 실제 정부 API 응답 픽스처(tests/fixtures/)로 파싱·graceful 계약·필터를 검증한다.
// 외부 네트워크는 globalThis.fetch를 모킹하여 차단한다.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractTag, stripHtml, formatDate } from '../src/core/utils.js';
import { fetchMssBizList } from '../src/core/mss-biz.js';
import { fetchBizinfoPrograms } from '../src/core/bizinfo.js';
import { fetchGov24ServiceList } from '../src/core/gov24.js';
import { fetchNaraBidList } from '../src/core/nara-bid.js';
import { fetchSmesNoticeList } from '../src/core/smes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 픽스처 파일을 문자열로 로드
function fixture(name) {
  return readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

// --- fetch 모킹 헬퍼 ---
// body 문자열을 반환하는 가짜 Response를 globalThis.fetch에 주입한다.
// 마지막 요청 URL을 capturedUrl로 보관해 파라미터 조립을 검증할 수 있게 한다.
let capturedUrl = null;
function mockFetch(body, { ok = true, status = 200 } = {}) {
  capturedUrl = null;
  globalThis.fetch = async (url) => {
    capturedUrl = String(url);
    return {
      ok,
      status,
      text: async () => body,
      json: async () => JSON.parse(body),
    };
  };
}

// 각 테스트 격리: fetch 원복 + 키 초기화
let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  process.env.DATA_GO_KR_SERVICE_KEY = 'TEST_KEY';
  process.env.BIZINFO_API_KEY = 'TEST_KEY';
  process.env.SMES_API_KEY = 'TEST_KEY';
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  capturedUrl = null;
});

// =====================================================================
// 1. utils.extractTag — CDATA / 일반 텍스트 / 정확 매칭
// =====================================================================
describe('utils.extractTag', () => {
  test('CDATA 블록을 추출한다', () => {
    const xml = '<title><![CDATA[안녕 <b>강조</b> & 기호]]></title>';
    assert.equal(extractTag(xml, 'title'), '안녕 <b>강조</b> & 기호');
  });

  test('일반 텍스트 태그를 추출한다', () => {
    assert.equal(extractTag('<itemId>1068897</itemId>', 'itemId'), '1068897');
  });

  test('없는 태그는 빈 문자열을 반환한다', () => {
    assert.equal(extractTag('<a>x</a>', 'b'), '');
  });

  test('앞뒤 공백을 제거한다', () => {
    assert.equal(extractTag('<n>  값  </n>', 'n'), '값');
  });

  test('태그명 부분 일치를 방지한다 (title vs titleSub)', () => {
    // titleSub만 있을 때 title로 잘못 매칭하면 안 된다
    const xml = '<titleSub>잘못된값</titleSub><title>정상값</title>';
    assert.equal(extractTag(xml, 'title'), '정상값');
  });
});

// =====================================================================
// 2. utils.stripHtml — HTML 태그 제거 + 엔티티 정규화
// =====================================================================
describe('utils.stripHtml', () => {
  test('HTML 태그를 제거한다 (태그 자리에 공백을 넣지 않음)', () => {
    // 현재 동작: 태그를 빈 문자열로 치환하므로 인접 텍스트가 붙는다
    assert.equal(stripHtml('<p>가나<br/>다라</p>'), '가나다라');
    // 공백으로 분리된 태그는 연속 공백이 하나로 합쳐진다
    assert.equal(stripHtml('가나 <br/> 다라'), '가나 다라');
  });

  test('명명 엔티티를 정규화한다 (&amp; &lt; &gt; &quot;)', () => {
    assert.equal(stripHtml('A&amp;B &lt;태그&gt; &quot;인용&quot;'), 'A&B <태그> "인용"');
  });

  test('숫자 엔티티 &#39; 를 작은따옴표로 바꾼다', () => {
    assert.equal(stripHtml('&#39;작은따옴표&#39;'), "'작은따옴표'");
  });

  test('알 수 없는 숫자/16진 엔티티는 제거한다', () => {
    assert.equal(stripHtml('a&#9888;b&#x2764;c'), 'abc');
  });

  test('&nbsp; 는 공백으로 바꾸고 연속 공백을 합친다', () => {
    assert.equal(stripHtml('가&nbsp;&nbsp;나'), '가 나');
  });

  test('null/undefined 입력은 빈 문자열을 반환한다', () => {
    assert.equal(stripHtml(null), '');
    assert.equal(stripHtml(undefined), '');
  });
});

// =====================================================================
// 3. utils.formatDate — YYYYMMDD 정규화
// =====================================================================
describe('utils.formatDate', () => {
  test('YYYYMMDD 를 YYYY-MM-DD 로 변환한다', () => {
    assert.equal(formatDate('20260611'), '2026-06-11');
  });

  test('이미 ISO 형식이면 8자리 기준으로 잘라 정규화한다', () => {
    assert.equal(formatDate('2026-06-11'), '2026-06-11');
  });

  test('시간이 붙어도 날짜 부분만 추출한다', () => {
    assert.equal(formatDate('2026-06-01 00:59:50'), '2026-06-01');
  });

  test('빈 값은 빈 문자열을 반환한다', () => {
    assert.equal(formatDate(''), '');
    assert.equal(formatDate(null), '');
  });

  test('8자리 미만/비숫자는 원본을 반환한다', () => {
    assert.equal(formatDate('상시모집'), '상시모집');
    assert.equal(formatDate('2026'), '2026');
  });
});

// =====================================================================
// 4. fetchMssBizList — XML 파싱 / CDATA / 500자 제한 / 깨진 스키마
// =====================================================================
describe('fetchMssBizList (중기부 XML)', () => {
  test('정상 응답을 파싱한다 (totalCount, item, CDATA 제목)', async () => {
    mockFetch(fixture('mss-biz.xml'));
    const r = await fetchMssBizList({ numOfRows: 2 });
    assert.equal(r.totalCount, 2125);
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0].itemId, '1068897');
    assert.match(r.items[0].title, /민관협력 오픈이노베이션/);
    assert.equal(r.items[0].applicationEndDate, '2026-06-11');
  });

  test('dataContents의 HTML/엔티티를 정리한다', async () => {
    mockFetch(fixture('mss-biz.xml'));
    const r = await fetchMssBizList();
    const c = r.items[0].dataContents;
    assert.ok(!c.includes('<br'), 'HTML 태그가 남아있으면 안 됨');
    assert.ok(c.includes('A&B'), '&amp; 가 & 로 복원되어야 함');
    assert.ok(c.includes('<태그>'), '&lt;&gt; 가 복원되어야 함');
    assert.ok(c.includes("'작은따옴표'"), '&#39; 가 복원되어야 함');
  });

  test('dataContents를 500자로 제한한다', async () => {
    mockFetch(fixture('mss-biz.xml'));
    const r = await fetchMssBizList();
    assert.ok(r.items[1].dataContents.length <= 500);
  });

  test('20260601 형식 날짜도 정규화한다', async () => {
    mockFetch(fixture('mss-biz.xml'));
    const r = await fetchMssBizList();
    assert.equal(r.items[1].applicationStartDate, '2026-06-01');
  });

  test('스키마가 깨져 item이 없으면 빈 배열 (graceful)', async () => {
    mockFetch(fixture('mss-biz-broken.xml'));
    const r = await fetchMssBizList();
    assert.deepEqual(r.items, []);
    assert.equal(r.totalCount, 0);
  });

  test('키 미설정 시 throw 없이 warning 반환 (graceful 계약)', async () => {
    delete process.env.DATA_GO_KR_SERVICE_KEY;
    const r = await fetchMssBizList();
    assert.deepEqual(r.items, []);
    assert.match(r.warning, /DATA_GO_KR_SERVICE_KEY/);
  });
});

// =====================================================================
// 5. fetchBizinfoPrograms — RSS 파싱 / 해시태그 분리 / 에러 JSON
// =====================================================================
describe('fetchBizinfoPrograms (기업마당 RSS)', () => {
  test('정상 RSS를 파싱한다 (pblancNm, CDATA, HTML 정리)', async () => {
    mockFetch(fixture('bizinfo-rss.xml'));
    const r = await fetchBizinfoPrograms();
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0].title, '2026년 청년창업 사관학교 입교생 모집');
    assert.ok(!r.items[0].description.includes('<p>'), 'HTML 제거 확인');
    assert.ok(r.items[0].description.includes('A&B'));
  });

  test('해시태그를 쉼표/전각쉼표로 분리해 배열로 만든다', async () => {
    mockFetch(fixture('bizinfo-rss.xml'));
    const r = await fetchBizinfoPrograms();
    assert.deepEqual(r.items[0].hashtags, ['창업', '청년', '지원금']);
  });

  test('pblancNm 없으면 title로, pblancUrl 없으면 link로 폴백한다', async () => {
    mockFetch(fixture('bizinfo-rss.xml'));
    const r = await fetchBizinfoPrograms();
    assert.equal(r.items[1].title, '해시태그 없는 공고 (title 폴백 테스트)');
    assert.equal(r.items[1].noticeUrl, 'https://www.bizinfo.go.kr/view?id=PBLN_002');
    assert.deepEqual(r.items[1].hashtags, []);
  });

  test('JSON 에러 응답을 감지해 error 필드로 반환한다', async () => {
    mockFetch(fixture('bizinfo-error.json'));
    const r = await fetchBizinfoPrograms();
    assert.deepEqual(r.items, []);
    assert.match(r.error, /인증키/);
  });

  test('키 미설정 시 warning 반환 (graceful)', async () => {
    delete process.env.BIZINFO_API_KEY;
    const r = await fetchBizinfoPrograms();
    assert.deepEqual(r.items, []);
    assert.match(r.warning, /BIZINFO_API_KEY/);
  });
});

// =====================================================================
// 6. fetchGov24ServiceList — JSON 한글필드 정규화 / data 없음
// =====================================================================
describe('fetchGov24ServiceList (정부24 JSON)', () => {
  test('한글 필드를 camelCase로 정규화한다', async () => {
    mockFetch(fixture('gov24-list.json'));
    const r = await fetchGov24ServiceList({ keyword: '청년' });
    assert.equal(r.totalCount, 1530);
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0].serviceId, 'SVC_0001');
    assert.equal(r.items[0].serviceName, '청년월세 한시 특별지원');
    assert.equal(r.items[0].agency, '국토교통부');
  });

  test('누락 필드는 빈 문자열로 채운다', async () => {
    mockFetch(fixture('gov24-list.json'));
    const r = await fetchGov24ServiceList({ keyword: 'x' });
    assert.equal(r.items[1].purpose, '');
    assert.equal(r.items[1].applyUrl, '');
  });

  test('data 필드가 없으면 빈 배열 + warning (graceful)', async () => {
    mockFetch(fixture('gov24-broken.json'));
    const r = await fetchGov24ServiceList({ keyword: 'x' });
    assert.deepEqual(r.items, []);
    assert.match(r.warning, /응답 이상/);
  });

  test('키 미설정 시 warning 반환 (graceful)', async () => {
    delete process.env.DATA_GO_KR_SERVICE_KEY;
    const r = await fetchGov24ServiceList({ keyword: 'x' });
    assert.deepEqual(r.items, []);
    assert.match(r.warning, /DATA_GO_KR_SERVICE_KEY/);
  });
});

// =====================================================================
// 7. fetchNaraBidList — JSON 파싱 / 에러 헤더 감지 / 필수 파라미터
// =====================================================================
describe('fetchNaraBidList (나라장터 JSON)', () => {
  test('정상 응답을 파싱한다 (totalCount, 날짜 정규화)', async () => {
    mockFetch(fixture('nara-list.json'));
    const r = await fetchNaraBidList({ numOfRows: 2 });
    assert.equal(r.totalCount, 87);
    assert.equal(r.items.length, 2);
    assert.equal(r.items[0].bidNtceNo, 'R26BK01553009');
    assert.equal(r.items[0].bidNtceDt, '2026-06-01');
    assert.equal(r.items[1].bidClseDt, '2026-06-20');
  });

  test('에러 헤더(resultCode≠00) 응답은 빈 배열 + warning (graceful, 조용한 실패 방지)', async () => {
    mockFetch(fixture('nara-error.json'));
    const r = await fetchNaraBidList();
    assert.deepEqual(r.items, []);
    assert.ok(r.warning, '에러 헤더 응답은 warning을 반환해야 함');
    assert.match(r.warning, /필수값|08/);
  });

  test('inqryDiv=1 과 날짜 범위를 자동으로 설정한다 (필수 파라미터)', async () => {
    mockFetch(fixture('nara-list.json'));
    await fetchNaraBidList();
    assert.match(capturedUrl, /inqryDiv=1/);
    assert.match(capturedUrl, /inqryBgnDt=\d{12}/);
    assert.match(capturedUrl, /inqryEndDt=\d{12}/);
  });

  test('호출자가 날짜를 주면 그 값을 사용한다', async () => {
    mockFetch(fixture('nara-list.json'));
    await fetchNaraBidList({ inqryBgnDt: '202601010000', inqryEndDt: '202601312359' });
    assert.match(capturedUrl, /inqryBgnDt=202601010000/);
    assert.match(capturedUrl, /inqryEndDt=202601312359/);
  });

  // 회귀 방지: 기본 오퍼레이션(getBidPblancListInfoServc)은 bidNtceNm을 조용히 무시한다.
  // 실 API 확인(2026-07-28): 키워드 유무와 무관하게 totalCount 13627 동일 → 검색이 전혀 안 됨.
  // 검색이 실제로 동작하는 것은 조달청 검색 오퍼레이션(...PPSSrch)뿐이다.
  test('검색 지원 오퍼레이션(PPSSrch)을 호출한다', async () => {
    mockFetch(fixture('nara-list.json'));
    await fetchNaraBidList();
    assert.match(capturedUrl, /getBidPblancListInfoServcPPSSrch/);
  });

  test('keyword를 주면 bidNtceNm 파라미터로 전달한다', async () => {
    mockFetch(fixture('nara-list.json'));
    await fetchNaraBidList({ keyword: '제주' });
    assert.match(capturedUrl, /getBidPblancListInfoServcPPSSrch/);
    assert.match(capturedUrl, /bidNtceNm=%EC%A0%9C%EC%A3%BC/);
  });

  test('type을 바꿔도 검색 오퍼레이션을 유지한다 (공사/물품)', async () => {
    mockFetch(fixture('nara-list.json'));
    await fetchNaraBidList({ type: 'Cnstwk', keyword: '제주' });
    assert.match(capturedUrl, /getBidPblancListInfoCnstwkPPSSrch/);
  });

  test('HTTP 에러는 error 필드로 반환한다', async () => {
    mockFetch('{}', { ok: false, status: 500 });
    const r = await fetchNaraBidList();
    assert.deepEqual(r.items, []);
    assert.match(r.error, /HTTP 500/);
  });

  test('키 미설정 시 warning 반환 (graceful)', async () => {
    delete process.env.DATA_GO_KR_SERVICE_KEY;
    const r = await fetchNaraBidList();
    assert.deepEqual(r.items, []);
    assert.match(r.warning, /DATA_GO_KR_SERVICE_KEY/);
  });
});

// =====================================================================
// 8. fetchSmesNoticeList — 마감일 필터 (파싱 실패 시 통과) / 인증 에러
// =====================================================================
describe('fetchSmesNoticeList (중소벤처24 마감일 필터)', () => {
  test('마감 지난 공고는 제외, 미래 공고는 포함한다', async () => {
    mockFetch(fixture('smes-list.json'));
    const r = await fetchSmesNoticeList();
    const titles = r.items.map((i) => i.title);
    assert.ok(!titles.includes('마감 지난 공고 (제외 대상)'), '과거 공고는 제외');
    assert.ok(titles.includes('미래 마감 공고 (포함 대상)'), '미래 공고는 포함');
  });

  test('마감일 파싱 실패 항목은 필터를 통과시킨다 (API 형식 신뢰)', async () => {
    mockFetch(fixture('smes-list.json'));
    const r = await fetchSmesNoticeList();
    const titles = r.items.map((i) => i.title);
    assert.ok(titles.includes('마감일 파싱 불가 공고 (통과 대상)'), '파싱 불가 날짜는 통과해야 함');
    assert.ok(titles.includes('마감일 없는 공고 (통과 대상)'), '빈 날짜는 통과해야 함');
  });

  test('HTML 태그가 description/target에서 제거된다', async () => {
    mockFetch(fixture('smes-list.json'));
    const r = await fetchSmesNoticeList();
    const future = r.items.find((i) => i.title.includes('미래'));
    assert.ok(!future.description.includes('<p>'));
    assert.ok(future.description.includes('A&B'));
  });

  test('인증 에러 구조(resultCd=9)는 빈 배열 + warning (graceful)', async () => {
    mockFetch(fixture('smes-auth-error.json'));
    const r = await fetchSmesNoticeList();
    assert.deepEqual(r.items, []);
    assert.match(r.warning, /응답 구조 확인/);
  });

  test('키 미설정 시 warning 반환 (graceful)', async () => {
    delete process.env.SMES_API_KEY;
    const r = await fetchSmesNoticeList();
    assert.deepEqual(r.items, []);
    assert.match(r.warning, /SMES_API_KEY/);
  });
});
