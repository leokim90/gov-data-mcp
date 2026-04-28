// --- 스모크 테스트: import 무결성 + 키 없을 때 graceful 동작 확인 ---
// 실제 외부 API는 호출하지 않는다 (키가 없을 때만 동작 검증)

import {
  fetchMssBizList,
  fetchGov24ServiceList,
  fetchBizinfoPrograms,
  fetchNaraBidList,
  fetchSmesNoticeList,
} from '../src/index.js';

const tests = [
  ['fetchMssBizList', () => fetchMssBizList()],
  ['fetchGov24ServiceList', () => fetchGov24ServiceList({ keyword: 'test' })],
  ['fetchBizinfoPrograms', () => fetchBizinfoPrograms()],
  ['fetchNaraBidList', () => fetchNaraBidList()],
  ['fetchSmesNoticeList', () => fetchSmesNoticeList()],
];

// 키 미설정 상태로 임시 클리어 — 모든 함수가 graceful 처리 확인용
delete process.env.DATA_GO_KR_SERVICE_KEY;
delete process.env.BIZINFO_API_KEY;
delete process.env.SMES_API_KEY;

let pass = 0;
let fail = 0;

for (const [name, fn] of tests) {
  try {
    const result = await fn();
    if (result && Array.isArray(result.items)) {
      console.log(`✓ ${name} — items=${result.items.length}, warning=${result.warning || 'none'}`);
      pass++;
    } else {
      console.log(`✗ ${name} — 예상 형식 아님: ${JSON.stringify(result).slice(0, 100)}`);
      fail++;
    }
  } catch (err) {
    console.log(`✗ ${name} — throw: ${err.message}`);
    fail++;
  }
}

console.log(`\n결과: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
