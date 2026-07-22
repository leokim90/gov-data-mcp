// MCP HTTP 핸드셰이크 테스트 — http-server를 스폰해 인증 + initialize + tools/list 확인 (API 키 불필요)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const serverPath = join(dir, '../src/http-server.js');

const PORT = 18788;
const TOKEN = 'test-token-for-handshake';
const BASE = `http://127.0.0.1:${PORT}`;

const EXPECTED_TOOLS = [
  'fetch_mss_biz', 'fetch_gov24_services', 'fetch_gov24_service_detail',
  'fetch_bizinfo_programs', 'fetch_nara_bids', 'fetch_smes_notices',
];

// MCP POST 공통 헤더 (Streamable HTTP는 두 Accept 타입 모두 요구)
const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

const child = spawn('node', [serverPath], {
  env: { ...process.env, AUTH_TOKEN: TOKEN, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let failed = 0;
function report(ok, name, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: ${detail}`}`);
  if (!ok) failed += 1;
}

// 서버 기동 대기: /healthz 폴링 (최대 10초)
async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return res.json();
    } catch { /* 아직 기동 전 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('서버 기동 타임아웃 (10초)');
}

try {
  const health = await waitForServer();
  report(health.ok === true && !!health.usage, 'healthz 응답 (ok + usage 노출)');

  // 1. 토큰 없이 /mcp → 401
  const noAuth = await fetch(`${BASE}/mcp`, {
    method: 'POST', headers: MCP_HEADERS, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  });
  report(noAuth.status === 401, '토큰 없음 → 401', `status=${noAuth.status}`);

  // 2. 잘못된 경로 토큰 → 401
  const badToken = await fetch(`${BASE}/t/wrong-token/mcp`, {
    method: 'POST', headers: MCP_HEADERS, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  });
  report(badToken.status === 401, '잘못된 토큰 → 401', `status=${badToken.status}`);

  // 3. 경로 토큰 방식으로 initialize
  const init = await fetch(`${BASE}/t/${TOKEN}/mcp`, {
    method: 'POST',
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'http-handshake-test', version: '0.0.1' },
      },
    }),
  });
  const initJson = await init.json();
  report(
    init.status === 200 && initJson.result?.serverInfo?.name === 'gov-data-mcp',
    'initialize 응답 (경로 토큰)',
    `status=${init.status} body=${JSON.stringify(initJson).slice(0, 200)}`,
  );

  // 4. Bearer 헤더 방식으로 tools/list (스테이트리스 — 요청 단독 처리)
  const list = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { ...MCP_HEADERS, Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  const listJson = await list.json();
  const names = (listJson.result?.tools || []).map((t) => t.name);
  const missing = EXPECTED_TOOLS.filter((t) => !names.includes(t));
  report(
    list.status === 200 && missing.length === 0,
    `tools/list — 도구 ${names.length}개 노출 (Bearer)`,
    `status=${list.status} 누락=${missing.join(',')} body=${JSON.stringify(listJson).slice(0, 200)}`,
  );
} catch (err) {
  report(false, '테스트 실행', err.message);
} finally {
  child.kill();
}

process.exit(failed ? 1 : 0);
