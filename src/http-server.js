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

// --- 인증 토큰 필수 ---
// 미설정 상태로 띄우면 공용 키가 무인증 공개되므로 기동 자체를 거부한다
const AUTH_TOKEN = process.env.AUTH_TOKEN;
if (!AUTH_TOKEN) {
  console.error('[gov-data-mcp] AUTH_TOKEN 미설정 — 무인증 공개를 막기 위해 기동을 거부합니다. (생성: openssl rand -hex 24)');
  process.exit(1);
}

const PORT = Number(process.env.PORT || 8787);

// 타이밍 공격 방지: 길이가 달라도 비교 시간이 일정하도록 해시 후 비교
function tokenMatches(candidate) {
  if (!candidate) return false;
  const a = createHash('sha256').update(String(candidate)).digest();
  const b = createHash('sha256').update(AUTH_TOKEN).digest();
  return timingSafeEqual(a, b);
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
function routeMcp(req, res) {
  if (req.method === 'POST') return handleMcp(req, res);
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method Not Allowed — POST만 지원합니다' },
    id: null,
  });
}

const app = express();
app.use(express.json({ limit: '1mb' }));

// 헬스체크: 배포 확인 + 사용량 모니터링 (증량 신청 시점 판단 근거)
app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    version: pkg.version,
    uptime: Math.round(process.uptime()),
    usage: usageSnapshot(),
    cacheEntries: cacheSize(),
  });
});

// 방식 1: Authorization: Bearer <token> 헤더
app.all('/mcp', (req, res) => {
  const bearer = (req.headers.authorization || '').match(/^Bearer (.+)$/)?.[1];
  if (!tokenMatches(bearer)) return unauthorized(res);
  routeMcp(req, res);
});

// 방식 2: 경로 토큰 — 헤더 설정을 지원하지 않는 클라이언트 대비
app.all('/t/:token/mcp', (req, res) => {
  if (!tokenMatches(req.params.token)) return unauthorized(res);
  routeMcp(req, res);
});

app.listen(PORT, () => {
  console.error(`[gov-data-mcp] HTTP 서버 시작 — port ${PORT}, 엔드포인트 /mcp (Bearer) · /t/<token>/mcp`);
});
