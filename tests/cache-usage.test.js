// 캐시(TTL)·사용량 카운터 단위테스트 — 외부 API 불필요
import test from 'node:test';
import assert from 'node:assert/strict';

import { cacheGet, cacheSet, cacheSize, _clearCacheForTest } from '../src/core/cache.js';
import {
  LIMITS, sourceFromUrl, assertQuota, recordCall, usageSnapshot, _resetUsageForTest,
} from '../src/core/usage.js';

test('cache: set 후 get으로 값 반환', () => {
  _clearCacheForTest();
  cacheSet('k1', { a: 1 }, 1000);
  assert.deepEqual(cacheGet('k1'), { a: 1 });
  assert.equal(cacheSize(), 1);
});

test('cache: TTL 만료 후 undefined', async () => {
  _clearCacheForTest();
  cacheSet('k2', 'v', 10);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(cacheGet('k2'), undefined);
});

test('cache: 없는 키는 undefined', () => {
  _clearCacheForTest();
  assert.equal(cacheGet('none'), undefined);
});

test('usage: URL → 소스 판별', () => {
  assert.equal(sourceFromUrl('https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2?x=1'), 'datago');
  // odcloud(정부24)도 data.go.kr 키/쿼터로 합산
  assert.equal(sourceFromUrl('https://api.odcloud.kr/api/gov24/v3/serviceList'), 'datago');
  assert.equal(sourceFromUrl('https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do'), 'bizinfo');
  assert.equal(sourceFromUrl('https://www.smes.go.kr/fnct/apiReqst/extPblancInfo'), 'smes');
  assert.equal(sourceFromUrl('https://example.com/'), null);
});

test('usage: 한도 도달 시 명확한 메시지로 throw', () => {
  _resetUsageForTest();
  // bizinfo 한도까지 채운 뒤 검사 — 다음 호출은 차단돼야 한다
  for (let i = 0; i < LIMITS.bizinfo; i += 1) recordCall('bizinfo');
  assert.throws(() => assertQuota('bizinfo'), /일일 호출 한도/);
  // data.go.kr 카운터는 독립적으로 통과
  assert.doesNotThrow(() => assertQuota('datago'));
  _resetUsageForTest();
});

test('usage: 스냅샷 형태 확인', () => {
  _resetUsageForTest();
  recordCall('datago');
  const snap = usageSnapshot();
  assert.equal(snap.datago.used, 1);
  assert.equal(snap.datago.limit, LIMITS.datago);
  assert.equal(snap.bizinfo.used, 0);
  assert.equal(snap.smes.used, 0);
  assert.match(snap.date, /^\d{4}-\d{2}-\d{2}$/);
  _resetUsageForTest();
});
