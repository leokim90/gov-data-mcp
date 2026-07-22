// --- 일일 API 사용량 카운터 ---
// 공용 키 배포 시 쿼터 소진을 감지·차단한다 (조용한 실패 금지).
// data.go.kr 실제 한도: 개발계정 기능당 10,000/일 — 여유분을 남기고 낮게 잡는다.
// bizinfo/smes는 공식 쿼터 미공개 — 보수적으로 1,000/일로 시작, 카운터 보고 조정.
export const LIMITS = { datago: 8000, bizinfo: 1000, smes: 1000 };

const SOURCE_LABEL = {
  datago: 'data.go.kr',
  bizinfo: '기업마당',
  smes: '중소벤처24',
};

// 날짜가 바뀌면(KST 기준) 카운터 자동 리셋
const state = { date: null, counts: { datago: 0, bizinfo: 0, smes: 0 } };

function todayKST() {
  // sv-SE 로케일은 YYYY-MM-DD 형식을 반환
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function rollover() {
  const today = todayKST();
  if (state.date !== today) {
    state.date = today;
    state.counts = { datago: 0, bizinfo: 0, smes: 0 };
  }
}

// 요청 URL → 사용량 집계 소스 판별 (해당 없으면 null)
// odcloud(정부24)는 data.go.kr 인프라 — 같은 키/쿼터라 datago로 합산한다
export function sourceFromUrl(url) {
  if (url.includes('apis.data.go.kr') || url.includes('api.odcloud.kr')) return 'datago';
  if (url.includes('bizinfo.go.kr')) return 'bizinfo';
  if (url.includes('smes.go.kr')) return 'smes';
  return null;
}

// 한도 도달 시 명확한 메시지로 throw — 도구 핸들러가 잡아 isError로 반환
export function assertQuota(source) {
  rollover();
  if (state.counts[source] >= LIMITS[source]) {
    throw new Error(
      `${SOURCE_LABEL[source]} 일일 호출 한도(${LIMITS[source].toLocaleString()}회) 도달 — ` +
      `KST 자정 이후 다시 시도하거나 관리자에게 쿼터 증량을 요청하세요`,
    );
  }
}

export function recordCall(source) {
  rollover();
  state.counts[source] += 1;
}

// /healthz 노출용 스냅샷
export function usageSnapshot() {
  rollover();
  return {
    date: state.date,
    datago: { used: state.counts.datago, limit: LIMITS.datago },
    bizinfo: { used: state.counts.bizinfo, limit: LIMITS.bizinfo },
    smes: { used: state.counts.smes, limit: LIMITS.smes },
  };
}

// 테스트 전용: 카운터 초기화
export function _resetUsageForTest() {
  state.date = todayKST();
  state.counts = { datago: 0, bizinfo: 0, smes: 0 };
}
