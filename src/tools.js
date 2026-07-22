// --- 도구 정의 + 공통 디스패처 ---
// stdio(mcp-server.js)와 HTTP(http-server.js) 두 진입점이 공유하는 단일 도구 세트.
// 캐시·요청 로그도 여기서 일괄 처리해 진입점과 무관하게 동일하게 동작한다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  fetchMssBizList,
  fetchGov24ServiceList,
  fetchGov24ServiceDetail,
  fetchBizinfoPrograms,
  fetchNaraBidList,
  fetchSmesNoticeList,
} from './core/index.js';
import { cacheGet, cacheSet } from './core/cache.js';

// 버전은 package.json에서 읽어 단일 출처 유지 (하드코딩 시 npm version과 어긋남)
export const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf-8'),
);

// --- 도구 정의: 이름·설명·스키마·핸들러를 한 곳에서 관리 ---
export const tools = [
  {
    name: 'fetch_mss_biz',
    description:
      '중소벤처기업부 사업공고 목록을 가져온다. 신청기간·담당자·첨부파일 정보 포함. 환경변수 DATA_GO_KR_SERVICE_KEY 필요.',
    inputSchema: {
      type: 'object',
      properties: {
        numOfRows: {
          type: 'number',
          description: '한 번에 가져올 공고 수 (기본 20, 최대 100 권장)',
          default: 20,
        },
        pageNo: {
          type: 'number',
          description: '페이지 번호 (기본 1)',
          default: 1,
        },
      },
    },
    handler: (args) => fetchMssBizList(args || {}),
  },
  {
    name: 'fetch_gov24_services',
    description:
      '정부24 공공서비스(혜택) 목록을 키워드로 검색한다. 예: "소상공인", "청년창업", "중소기업". 환경변수 DATA_GO_KR_SERVICE_KEY 필요.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '서비스명 부분일치 검색 키워드 (필수 권장)',
        },
        perPage: { type: 'number', description: '페이지당 건수 (기본 20)', default: 20 },
        page: { type: 'number', description: '페이지 번호 (기본 1)', default: 1 },
      },
      required: ['keyword'],
    },
    handler: (args) => fetchGov24ServiceList(args || {}),
  },
  {
    name: 'fetch_bizinfo_programs',
    description:
      '기업마당(bizinfo.go.kr) 지원사업을 조회한다. NIPA·KISA·중진공·TIPA 등 전 부처 산하기관 공고를 통합 제공. 환경변수 BIZINFO_API_KEY 필요.',
    inputSchema: {
      type: 'object',
      properties: {
        searchCnt: {
          type: 'number',
          description: '조회 건수 (기본 20)',
          default: 20,
        },
      },
    },
    handler: (args) => fetchBizinfoPrograms(args || {}),
  },
  {
    name: 'fetch_nara_bids',
    description:
      '나라장터 입찰공고를 조회한다. type으로 용역/공사/물품/외자 선택 가능. keyword로 공고명 검색 가능. 환경변수 DATA_GO_KR_SERVICE_KEY 필요.',
    inputSchema: {
      type: 'object',
      properties: {
        numOfRows: { type: 'number', description: '조회 건수 (기본 20)', default: 20 },
        pageNo: { type: 'number', description: '페이지 번호 (기본 1)', default: 1 },
        type: {
          type: 'string',
          enum: ['Servc', 'Cnstwk', 'Thng', 'Frgcpt'],
          description: '공고 유형 — Servc(용역, 기본) / Cnstwk(공사) / Thng(물품) / Frgcpt(외자)',
          default: 'Servc',
        },
        keyword: { type: 'string', description: '공고명 키워드 검색 (선택)' },
        inqryBgnDt: {
          type: 'string',
          description: '조회 시작일시 YYYYMMDDHHMM (선택)',
        },
        inqryEndDt: {
          type: 'string',
          description: '조회 종료일시 YYYYMMDDHHMM (선택)',
        },
      },
    },
    handler: (args) => fetchNaraBidList(args || {}),
  },
  {
    name: 'fetch_smes_notices',
    description:
      '중소벤처24(smes.go.kr) 산하기관 공고를 조회한다. 마감일 지난 공고는 자동 제외. 환경변수 SMES_API_KEY 필요.',
    inputSchema: {
      type: 'object',
      properties: {
        numOfRows: { type: 'number', description: '조회 건수 (기본 20)', default: 20 },
        pageNo: { type: 'number', description: '페이지 번호 (기본 1)', default: 1 },
      },
    },
    handler: (args) => fetchSmesNoticeList(args || {}),
  },
  {
    name: 'fetch_gov24_service_detail',
    description:
      '정부24 공공서비스 상세 정보를 조회한다. fetch_gov24_services로 얻은 serviceId를 넘기면 신청자격·구비서류·지원금액 등 상세 내용을 반환한다. 환경변수 DATA_GO_KR_SERVICE_KEY 필요.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: '서비스ID (fetch_gov24_services 결과의 serviceId 값)' },
      },
      required: ['serviceId'],
    },
    handler: (args) => fetchGov24ServiceDetail(args || {}),
  },
];

// --- 도구별 캐시 TTL ---
// 공고류는 하루 단위로 갱신되므로 1h, 정부24 검색은 6h, 서비스 상세는 사실상 정적(24h)
const HOUR = 3600 * 1000;
const CACHE_TTL_MS = {
  fetch_mss_biz: 1 * HOUR,
  fetch_gov24_services: 6 * HOUR,
  fetch_gov24_service_detail: 24 * HOUR,
  fetch_bizinfo_programs: 1 * HOUR,
  fetch_nara_bids: 1 * HOUR,
  fetch_smes_notices: 1 * HOUR,
};

// 캐시 키용 안정 직렬화 — 인자 순서가 달라도 같은 요청이면 같은 키
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// 도구 실행 디스패처: 캐시 조회 → 실행 → 캐시 저장 → stderr 한 줄 JSON 로그
export async function callTool(name, args = {}) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }

  const started = Date.now();
  let cacheHit = false;
  let ok = true;
  try {
    const cacheKey = `${name}:${stableStringify(args)}`;
    let result = cacheGet(cacheKey);
    if (result !== undefined) {
      cacheHit = true;
    } else {
      result = await tool.handler(args);
      // 성공 결과만 캐시 (에러는 캐시하지 않음)
      cacheSet(cacheKey, result, CACHE_TTL_MS[name] ?? 1 * HOUR);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    ok = false;
    return { isError: true, content: [{ type: 'text', text: `${name} 실행 실패: ${err.message}` }] };
  } finally {
    // stdout은 stdio JSON-RPC 전용 — 로그는 반드시 stderr
    process.stderr.write(
      `${JSON.stringify({ ts: new Date().toISOString(), tool: name, ms: Date.now() - started, cacheHit, ok })}\n`,
    );
  }
}

// MCP Server 인스턴스 생성 — stdio는 1회, HTTP 스테이트리스는 요청마다 호출
export function createMcpServer() {
  const server = new Server(
    { name: 'gov-data-mcp', version: pkg.version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) =>
    callTool(req.params.name, req.params.arguments || {}),
  );

  return server;
}
