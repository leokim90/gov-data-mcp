#!/usr/bin/env node
// --- 한국 정부 공공데이터 MCP 서버 (HTTP 진입점, Streamable HTTP) ---
// 원격 배포용: 팀원은 Claude Desktop 커스텀 커넥터에 URL만 등록하면 된다.
// 스테이트리스 모드 — 요청마다 Server+Transport를 새로 만들어 세션 관리 없이 처리
import { createHash, timingSafeEqual } from 'node:crypto';

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { loadDotEnv } from './env.js';
import { createMcpServer, pkg } from './tools.js';
import { usageSnapshot } from './core/usage.js';
import { cacheSize } from './core/cache.js';

loadDotEnv();

// --- 인증 토큰 로딩: AUTH_TOKEN(단일, 기존) + AUTH_TOKENS(다중, 부서 배포용) 병행 ---
// AUTH_TOKENS 형식: "finance:토큰값,sales:토큰값" — 부서별 발급/회수 + 라벨별 사용량 집계용.
// 기존 AUTH_TOKEN은 'default' 라벨로 계속 동작한다 (하위호환 — 이미 배포된 토큰 회수 불필요).
function sha256(value) {
  return createHash('sha256').update(String(value)).digest();
}

// 타이밍 공격 방지: 해시 후 고정 시간 비교 (기존 tokenMatches 방식 유지)
const tokenRegistry = []; // { label, hash }

const AUTH_TOKEN = process.env.AUTH_TOKEN;
if (AUTH_TOKEN) {
  tokenRegistry.push({ label: 'default', hash: sha256(AUTH_TOKEN) });
}

const rawAuthTokens = (process.env.AUTH_TOKENS || '').trim();
if (rawAuthTokens) {
  for (const entry of rawAuthTokens.split(',')) {
    const item = entry.trim();
    if (!item) continue;
    // 첫 콜론 기준 분리 — 토큰 값에 콜론이 있어도 라벨은 깨지지 않는다
    const sep = item.indexOf(':');
    if (sep <= 0 || sep === item.length - 1) {
      // 라벨 없는 토큰은 사용량 귀속이 불가능 → 조용히 넘기지 않고 기동 거부 (설정 실수를 크게 알림)
      console.error(`[gov-data-mcp] AUTH_TOKENS 형식 오류("${item}") — "라벨:토큰" 콤마 구분 형식이어야 합니다. 기동을 거부합니다.`);
      process.exit(1);
    }
    const label = item.slice(0, sep).trim();
    const token = item.slice(sep + 1).trim();
    if (label === 'default' || tokenRegistry.some((t) => t.label === label)) {
      // 라벨 중복이면 /healthz 사용량 집계가 섞인다 → 기동 거부 ('default'는 AUTH_TOKEN 예약)
      console.error(`[gov-data-mcp] AUTH_TOKENS 라벨 중복("${label}") — 라벨은 고유해야 합니다 ('default'는 AUTH_TOKEN 예약). 기동을 거부합니다.`);
      process.exit(1);
    }
    tokenRegistry.push({ label, hash: sha256(token) });
  }
}

// 토큰이 하나도 없으면 공용 키가 무인증 공개되므로 기동 자체를 거부한다 (기존 동작 유지)
if (tokenRegistry.length === 0) {
  console.error('[gov-data-mcp] AUTH_TOKEN/AUTH_TOKENS 미설정 — 무인증 공개를 막기 위해 기동을 거부합니다. (생성: openssl rand -hex 24)');
  process.exit(1);
}

const PORT = Number(process.env.PORT || 8787);

// 토큰 대조: 일치하면 라벨 반환, 아니면 null — 라벨은 사용량 집계에 쓰인다
function matchToken(candidate) {
  if (!candidate) return null;
  const candidateHash = sha256(candidate);
  for (const { label, hash } of tokenRegistry) {
    if (timingSafeEqual(candidateHash, hash)) return label;
  }
  return null;
}

// --- 라벨별 호출 카운터 (KST 자정 리셋) ---
// 어느 부서가 얼마나 쓰는지 /healthz로 확인 → 쿼터 소진 시 헤비 유저 식별 근거
const clientState = { date: null, counts: {} };

function todayKST() {
  // sv-SE 로케일은 YYYY-MM-DD 형식을 반환 (core/usage.js와 동일 방식)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function recordClient(label) {
  const today = todayKST();
  if (clientState.date !== today) {
    clientState.date = today;
    clientState.counts = {};
  }
  clientState.counts[label] = (clientState.counts[label] || 0) + 1;
}

function unauthorized(res) {
  res.status(401).json({
    jsonrpc: '2.0',
    error: { code: -32001, message: 'Unauthorized: 유효한 토큰이 필요합니다' },
    id: null,
  });
}

// MCP 요청 처리 — 스테이트리스: 요청마다 새 인스턴스 (세션 ID 없음)
async function handleMcp(req, res) {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(`[gov-data-mcp] MCP 요청 처리 실패: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

// 인증 통과 후 메서드 라우팅 — 스테이트리스라 GET(SSE)/DELETE(세션 종료)는 불필요
// 실제 MCP 처리(POST)만 라벨별 사용량에 집계한다 (405 오호출은 제외)
function routeMcp(req, res, label) {
  if (req.method === 'POST') {
    recordClient(label);
    return handleMcp(req, res);
  }
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method Not Allowed — POST만 지원합니다' },
    id: null,
  });
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// 헬스체크: 배포 확인 + 사용량 모니터링 (증량 신청·헤비 부서 식별 시점 판단 근거)
app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    version: pkg.version,
    uptime: Math.round(process.uptime()),
    usage: usageSnapshot(),
    clients: { date: clientState.date, counts: clientState.counts },
    cacheEntries: cacheSize(),
  });
});

// 방식 1: Authorization: Bearer <token> 헤더
app.all('/mcp', (req, res) => {
  const bearer = (req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
  const label = matchToken(bearer);
  if (!label) return unauthorized(res);
  routeMcp(req, res, label);
});

// 방식 2: 경로 토큰 — 헤더 설정을 지원하지 않는 클라이언트 대비
app.all('/t/:token/mcp', (req, res) => {
  const label = matchToken(req.params.token);
  if (!label) return unauthorized(res);
  routeMcp(req, res, label);
});

app.listen(PORT, () => {
  console.error(`[gov-data-mcp] HTTP 서버 시작 — port ${PORT}, 토큰 ${tokenRegistry.length}개(${tokenRegistry.map((t) => t.label).join(', ')}), 엔드포인트 /mcp (Bearer) · /t/<token>/mcp`);
});
