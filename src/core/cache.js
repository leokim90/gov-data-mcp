// --- 인메모리 TTL 캐시 (외부 의존성 없음) ---
// 공용 키 쿼터 보호가 목적 — 같은 조회를 반복 호출하지 않게 도구 결과를 잠시 보관한다.
const store = new Map();
const MAX_ENTRIES = 500;

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs) {
  // 용량 초과 시: 만료 항목 정리 → 그래도 차 있으면 가장 오래된 항목부터 제거
  if (store.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, e] of store) {
      if (now > e.expires) store.delete(k);
    }
    while (store.size >= MAX_ENTRIES) {
      store.delete(store.keys().next().value);
    }
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export function cacheSize() {
  return store.size;
}

// 테스트 전용: 캐시 비우기
export function _clearCacheForTest() {
  store.clear();
}
