#!/usr/bin/env node
// --- 한국 정부 공공데이터 MCP 서버 (stdio 모드) ---
// 5개 출처(중기부·정부24·기업마당·나라장터·중소벤처24)를 도구로 노출

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  fetchMssBizList,
  fetchGov24ServiceList,
  fetchBizinfoPrograms,
  fetchNaraBidList,
  fetchSmesNoticeList,
} from './core/index.js';

// --- 도구 정의: 이름·설명·스키마·핸들러를 한 곳에서 관리 ---
const tools = [
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
      '나라장터 입찰공고를 조회한다. type으로 용역/공사/물품/외자 선택 가능. 환경변수 DATA_GO_KR_SERVICE_KEY 필요.',
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
];

// --- MCP 서버 인스턴스 생성 ---
const server = new Server(
  { name: 'gov-data-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// 도구 목록 조회 — handler 필드는 외부에 노출하지 않음
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

// 도구 호출 — name으로 핸들러 찾아 실행, 결과는 JSON 직렬화하여 text 콘텐츠로 반환
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
    };
  }

  try {
    const result = await tool.handler(req.params.arguments || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `${tool.name} 실행 실패: ${err.message}` }],
    };
  }
});

// --- 서버 부팅 (stdio 트랜스포트) ---
const transport = new StdioServerTransport();
await server.connect(transport);

// 부팅 알림은 stderr로 — stdout은 MCP 프로토콜 전용
process.stderr.write('[gov-data-mcp] stdio 서버 시작\n');
