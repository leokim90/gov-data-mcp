#!/usr/bin/env node
// --- 한국 정부 공공데이터 MCP 서버 (stdio 진입점) ---
// 도구 정의·디스패치는 tools.js 공유 — HTTP 진입점(http-server.js)과 동일 세트
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadDotEnv } from './env.js';
import { createMcpServer } from './tools.js';

// 환경변수 폴백: 실행 주체(Desktop config 등)가 주입한 값이 우선, 없으면 .env
loadDotEnv();

const server = createMcpServer();
await server.connect(new StdioServerTransport());

// 부팅 알림은 stderr로 — stdout은 MCP 프로토콜 전용
process.stderr.write('[gov-data-mcp] stdio 서버 시작\n');
