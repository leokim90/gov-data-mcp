// --- MCP 서버 핸드셰이크 검증 ---
// stdio로 mcp-server.js 실행 → initialize → tools/list 응답 확인

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, '../src/mcp-server.js');

const child = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });

let stdoutBuf = '';
const responses = [];

child.stdout.on('data', (chunk) => {
  stdoutBuf += chunk.toString();
  // 줄바꿈 단위로 JSON-RPC 메시지 파싱
  let idx;
  while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
    const line = stdoutBuf.slice(0, idx).trim();
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (!line) continue;
    try {
      responses.push(JSON.parse(line));
    } catch {
      console.error('파싱 실패:', line.slice(0, 200));
    }
  }
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(`[server] ${chunk}`);
});

// 메시지 전송 헬퍼
function send(msg) {
  child.stdin.write(JSON.stringify(msg) + '\n');
}

// 1. initialize
send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test', version: '0.1.0' },
  },
});

// 2. initialized notification
send({ jsonrpc: '2.0', method: 'notifications/initialized' });

// 3. tools/list
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

// 응답 대기 후 결과 검증
await new Promise((r) => setTimeout(r, 1500));

child.kill();

let pass = true;
const init = responses.find((r) => r.id === 1);
const list = responses.find((r) => r.id === 2);

if (init?.result?.serverInfo?.name === 'gov-data-mcp') {
  console.log(`✓ initialize — server=${init.result.serverInfo.name} v${init.result.serverInfo.version}`);
} else {
  console.log('✗ initialize 응답 이상:', JSON.stringify(init));
  pass = false;
}

if (Array.isArray(list?.result?.tools)) {
  const names = list.result.tools.map((t) => t.name);
  console.log(`✓ tools/list — ${list.result.tools.length}개: ${names.join(', ')}`);
  const expected = [
    'fetch_mss_biz',
    'fetch_gov24_services',
    'fetch_gov24_service_detail',
    'fetch_bizinfo_programs',
    'fetch_nara_bids',
    'fetch_smes_notices',
  ];
  const missing = expected.filter((n) => !names.includes(n));
  if (missing.length > 0) {
    console.log('✗ 누락 도구:', missing);
    pass = false;
  }
} else {
  console.log('✗ tools/list 응답 이상:', JSON.stringify(list));
  pass = false;
}

process.exit(pass ? 0 : 1);
