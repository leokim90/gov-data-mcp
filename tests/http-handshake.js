// MCP HTTP 핸드셰이크 테스트 — http-server를 스폰해 인증 + initialize + tools/list 확인 (API 키 불필요)
// 페이즈 1: 기존 단일 AUTH_TOKEN 동작 (하위호환 보증)
// 페이즈 2: AUTH_TOKENS 다중 토큰(라벨:토큰) + /healthz 라벨별 사용량 노출
// 페이즈 3: AUTH_TOKENS 형식 오류 시 기동 거부
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const serverPath = join(dir, '../src/http-server.js');

const EXPECTED_TOOLS = [
  'fetch_mss_biz', 'fetch_gov24_services', 'fetch_gov24_service_detail',
  'fetch_bizinfo_programs', 'fetch_nara_bids', 'fetch_smes_notices',
];

// MCP POST 공통 헤더 (Streamable HTTP는 두 Accept 타입 모두 요구)
const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

let failed = 0;
function report(ok, name, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failed += 1;
}

// 서버 스폰 + /healthz 폴링으로 기동 대기 (최대 10초)
function spawnServer(extraEnv, port) {
  return spawn('node', [serverPath], {
    env: { ...process.env, PORT: String(port), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForServer(base) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) return res.json();
    } catch { /* 아직 기동 전 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('서버 기동 타임아웃 (10초)');
}

// 프로세스 종료 대기 (기동 거부 검증용)
function waitForExit(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('종료 타임아웃')), timeoutMs);
    child.on('exit', (code) => { clearTimeout(timer); resolve(code); });
  });
}

function mcpPost(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { ...MCP_HEADERS, ...headers },
    body: JSON.stringify(body),
  });
}

const PING = { jsonrpc: '2.0', id: 1, method: 'ping' };

// --- 페이즈 1: 단일 AUTH_TOKEN (기존 동작 하위호환) ---
async function phaseSingleToken() {
  const PORT = 18788;
  const TOKEN = 'test-token-for-handshake';
  const BASE = `http://127.0.0.1:${PORT}`;
  const child = spawnServer({ AUTH_TOKEN: TOKEN }, PORT);
  try {
    const health = await waitForServer(BASE);
    report(health.ok === true && !!health.usage, 'P1 healthz 응답 (ok + usage 노출)');

    // 1. 토큰 없이 /mcp → 401
    const noAuth = await mcpPost(`${BASE}/mcp`, PING);
    report(noAuth.status === 401, 'P1 토큰 없음 → 401', `status=${noAuth.status}`);

    // 2. 잘못된 경로 토큰 → 401
    const badToken = await mcpPost(`${BASE}/t/wrong-token/mcp`, PING);
    report(badToken.status === 401, 'P1 잘못된 토큰 → 401', `status=${badToken.status}`);

    // 3. 경로 토큰 방식으로 initialize
    const init = await mcpPost(`${BASE}/t/${TOKEN}/mcp`, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'http-handshake-test', version: '0.0.1' },
      },
    });
    const initJson = await init.json();
    report(
      init.status === 200 && initJson.result?.serverInfo?.name === 'gov-data-mcp',
      'P1 initialize 응답 (경로 토큰)',
      `status=${init.status} body=${JSON.stringify(initJson).slice(0, 200)}`,
    );

    // 4. Bearer 헤더 방식으로 tools/list (스테이트리스 — 요청 단독 처리)
    const list = await mcpPost(`${BASE}/mcp`, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { Authorization: `Bearer ${TOKEN}` });
    const listJson = await list.json();
    const names = (listJson.result?.tools || []).map((t) => t.name);
    const missing = EXPECTED_TOOLS.filter((t) => !names.includes(t));
    report(
      list.status === 200 && missing.length === 0,
      `P1 tools/list — 도구 ${names.length}개 노출 (Bearer)`,
      `status=${list.status} 누락=${missing.join(',')} body=${JSON.stringify(listJson).slice(0, 200)}`,
    );
  } finally {
    child.kill();
  }
}

// --- 페이즈 2: AUTH_TOKENS 다중 토큰 + 라벨별 사용량 ---
async function phaseMultiToken() {
  const PORT = 18789;
  const LEGACY = 'legacy-admin-token';
  const BASE = `http://127.0.0.1:${PORT}`;
  const child = spawnServer(
    { AUTH_TOKEN: LEGACY, AUTH_TOKENS: 'finance:tok-fin-1, sales:tok-sales-2' },
    PORT,
  );
  try {
    await waitForServer(BASE);

    // 1. 기존 AUTH_TOKEN이 계속 동작 (하위호환 핵심)
    const legacy = await mcpPost(`${BASE}/mcp`, PING, { Authorization: `Bearer ${LEGACY}` });
    report(legacy.status === 200, 'P2 기존 AUTH_TOKEN 유지 동작', `status=${legacy.status}`);

    // 2. 부서 토큰 — Bearer 방식
    const fin = await mcpPost(`${BASE}/mcp`, PING, { Authorization: 'Bearer tok-fin-1' });
    report(fin.status === 200, 'P2 부서 토큰(finance, Bearer) 인증', `status=${fin.status}`);

    // 3. 부서 토큰 — 경로 방식
    const sales = await mcpPost(`${BASE}/t/tok-sales-2/mcp`, PING);
    report(sales.status === 200, 'P2 부서 토큰(sales, 경로) 인증', `status=${sales.status}`);

    // 4. 등록 안 된 토큰 → 401
    const bad = await mcpPost(`${BASE}/mcp`, PING, { Authorization: 'Bearer tok-unknown' });
    report(bad.status === 401, 'P2 미등록 토큰 → 401', `status=${bad.status}`);

    // 5. /healthz에 라벨별 호출 수 노출 (default/finance/sales 각 1회 이상)
    const health = await (await fetch(`${BASE}/healthz`)).json();
    const c = health.clients?.counts || {};
    report(
      (c.default >= 1) && (c.finance >= 1) && (c.sales >= 1),
      'P2 healthz 라벨별 사용량 노출',
      `clients=${JSON.stringify(health.clients)}`,
    );
  } finally {
    child.kill();
  }
}

// --- 페이즈 3: AUTH_TOKENS 형식 오류 → 기동 거부 ---
async function phaseBadFormat() {
  const PORT = 18790;
  // 콜론 없는 항목은 라벨 없는 토큰 — 사용량 귀속이 불가능하므로 기동을 거부해야 한다
  const child = spawnServer({ AUTH_TOKEN: 'x', AUTH_TOKENS: 'no-colon-entry' }, PORT);
  try {
    const code = await waitForExit(child);
    report(code !== 0, 'P3 AUTH_TOKENS 형식 오류 → 기동 거부', `exitCode=${code}`);
  } catch (err) {
    report(false, 'P3 AUTH_TOKENS 형식 오류 → 기동 거부', err.message);
    child.kill();
  }
}

try {
  await phaseSingleToken();
  await phaseMultiToken();
  await phaseBadFormat();
} catch (err) {
  report(false, '테스트 실행', err.message);
}

process.exit(failed ? 1 : 0);
