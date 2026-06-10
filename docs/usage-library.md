# 사용 가이드 — npm 라이브러리 (개발자용)

MCP 클라이언트 없이, 일반 npm 모듈로 import해서 코드에서 직접 호출한다. 6개 fetch 함수 + 파싱 유틸을 export한다.

## 설치

```bash
npm install @leokim90/gov-data-mcp
```

- **Node 20+ 필요** (내장 `fetch` 사용)
- **ESM 전용** 패키지 (`"type": "module"`)

## 키 주입

패키지엔 dotenv가 없다. 함수는 호출 시점에 `process.env`를 읽으므로, **호출 전에** 채워야 한다.

```js
// A) 코드에서 직접
process.env.DATA_GO_KR_SERVICE_KEY = '발급키';

// B) 본인 프로젝트의 dotenv 사용
import 'dotenv/config';   // .env에 DATA_GO_KR_SERVICE_KEY=... 넣기

// C) 실행 시 셸에서
//   DATA_GO_KR_SERVICE_KEY=발급키 node app.js
```

키 발급 방법은 [MCP 설치 가이드 ① API 키 발급](install-mcp.md#-api-키-발급) 참조.

## 호출 (ESM)

```js
import {
  fetchMssBizList,
  fetchGov24ServiceList,
  fetchGov24ServiceDetail,
  fetchBizinfoPrograms,
  fetchNaraBidList,
  fetchSmesNoticeList,
} from '@leokim90/gov-data-mcp';

// 중기부 사업공고 3건
const mss = await fetchMssBizList({ numOfRows: 3 });

// 정부24 키워드 검색 (keyword 필수)
const gov = await fetchGov24ServiceList({ keyword: '청년창업', perPage: 10 });

// 정부24 상세 (위 결과의 serviceId)
const detail = await fetchGov24ServiceDetail({ serviceId: gov.items[0].serviceId });

// 기업마당 (BIZINFO_API_KEY 필요)
const biz = await fetchBizinfoPrograms({ searchCnt: 20 });

// 나라장터 입찰 (날짜 미지정 시 최근 30일 자동 조회)
const nara = await fetchNaraBidList({ numOfRows: 10, type: 'Servc', keyword: '데이터' });

// 중소벤처24 (SMES_API_KEY 필요, 마감 지난 공고 자동 제외)
const smes = await fetchSmesNoticeList({ numOfRows: 10 });
```

CommonJS 프로젝트면 동적 import:
```js
const { fetchMssBizList } = await import('@leokim90/gov-data-mcp');
```

## 함수 시그니처

| 함수 | 파라미터 (기본값) |
|------|-------------------|
| `fetchMssBizList` | `{ numOfRows=20, pageNo=1 }` |
| `fetchGov24ServiceList` | `{ keyword(필수), perPage=20, page=1 }` |
| `fetchGov24ServiceDetail` | `{ serviceId(필수) }` |
| `fetchBizinfoPrograms` | `{ searchCnt=20 }` |
| `fetchNaraBidList` | `{ numOfRows=20, pageNo=1, type='Servc', keyword?, inqryBgnDt?, inqryEndDt? }` |
| `fetchSmesNoticeList` | `{ numOfRows=20, pageNo=1 }` |

`type`: `Servc`(용역) · `Cnstwk`(공사) · `Thng`(물품) · `Frgcpt`(외자)
`inqryBgnDt`/`inqryEndDt`: `YYYYMMDDHHMM` 형식 (미지정 시 최근 30일 자동)

## 반환 형태 (graceful — throw하지 않음)

모든 함수는 항상 객체를 반환한다.

```js
// 정상
{ items: [...], totalCount: 2125, pageNo: 1, numOfRows: 3 }

// 키 없음 → 빈 배열 + warning
{ items: [], totalCount: 0, warning: 'DATA_GO_KR_SERVICE_KEY 미설정' }

// API 에러 → 빈 배열 + error
{ items: [], totalCount: 0, error: '...' }
```

`fetchGov24ServiceDetail`만 `{ item }` (단일 객체) 형태.

안전한 사용 패턴:
```js
const r = await fetchMssBizList({ numOfRows: 5 });
if (r.warning || r.error) { /* 폴백 처리 */ }
const items = r.items;   // 키 없어도 항상 배열 → .map() 안전
```

## 파싱 유틸 (선택)

필요하면 내부 유틸도 export됨:
```js
import { stripHtml, formatDate, extractTag } from '@leokim90/gov-data-mcp';
```

## TypeScript

타입 선언(`.d.ts`)이 없어 TS가 경고할 수 있다. 프로젝트에 선언 파일 하나 추가:
```ts
// types/gov-data-mcp.d.ts
declare module '@leokim90/gov-data-mcp';
```

Next.js에서 쓰려면 → [Next.js 사용 가이드](usage-nextjs.md)
