# gov-data-mcp

한국 정부 공공데이터 5종을 한 번에 호출하는 MCP(Model Context Protocol) 서버.
Claude Desktop / Claude Code 등 MCP 호환 클라이언트에서 자연어로 정부 사업·공고·서비스 데이터를 가져올 수 있다.

## 제공 도구 (5종)

| 도구명 | 설명 | 출처 |
|--------|------|------|
| `fetch_mss_biz` | 중소벤처기업부 사업공고 목록 | `apis.data.go.kr/1421000/mssBizService_v2` |
| `fetch_gov24_services` | 정부24 공공서비스(혜택) 키워드 검색 | `api.odcloud.kr/api/gov24/v3` |
| `fetch_bizinfo_programs` | 기업마당 지원사업 (NIPA·KISA·중진공·TIPA 등 통합) | `bizinfo.go.kr` |
| `fetch_nara_bids` | 나라장터 입찰공고 (용역/공사/물품/외자) | `apis.data.go.kr/1230000` |
| `fetch_smes_notices` | 중소벤처24 산하기관 공고 | `smes.go.kr/fnct/apiReqst/extPblancInfo` |

## 설치

### 1. API 키 발급 (각 5~10분, 본인 명의)

| 키 환경변수 | 발급 사이트 | 용도 |
|------------|------------|------|
| `DATA_GO_KR_SERVICE_KEY` | https://www.data.go.kr | 중기부 + 정부24 + 나라장터 (1개로 3개 API 공통) |
| `BIZINFO_API_KEY` | https://www.bizinfo.go.kr | 기업마당 |
| `SMES_API_KEY` | https://www.smes.go.kr | 중소벤처24 |

발급 후 각 사이트 마이페이지에서 활용 승인을 확인한다.
data.go.kr은 키 발급 후 활용 승인까지 1~2시간 걸릴 수 있다.

### 2. Claude Desktop / Claude Code에 등록

`claude_desktop_config.json` (Claude Desktop) 또는 `.mcp.json` (Claude Code)에 다음 추가:

```json
{
  "mcpServers": {
    "gov-data": {
      "command": "npx",
      "args": ["-y", "@leokim90/gov-data-mcp"],
      "env": {
        "DATA_GO_KR_SERVICE_KEY": "여기에_발급받은_키",
        "BIZINFO_API_KEY": "여기에_발급받은_키",
        "SMES_API_KEY": "여기에_발급받은_키"
      }
    }
  }
}
```

키가 없는 도구는 자동으로 빈 배열을 반환하므로, 필요한 키만 설정해도 동작한다.

## 사용 예시

Claude에 자연어로 요청:

- "오늘 중기부 사업공고 최신 10건 가져와줘"
- "기업마당에서 마감 임박 지원사업 알려줘"
- "정부24에서 '청년 창업' 키워드로 혜택 검색해줘"
- "나라장터 용역 입찰공고 최근 20건 보여줘"

## 라이브러리로도 사용 가능

MCP가 아니어도 일반 npm 모듈로 import해서 쓸 수 있다.

```js
import {
  fetchMssBizList,
  fetchBizinfoPrograms,
} from '@leokim90/gov-data-mcp';

const programs = await fetchBizinfoPrograms({ searchCnt: 20 });
```

## 도구 파라미터

### `fetch_mss_biz`
- `numOfRows` (number, 기본 20): 조회 건수
- `pageNo` (number, 기본 1)

### `fetch_gov24_services`
- `keyword` (string, **필수**): 검색 키워드 (예: "소상공인", "청년창업")
- `perPage` (number, 기본 20)
- `page` (number, 기본 1)

### `fetch_bizinfo_programs`
- `searchCnt` (number, 기본 20): 조회 건수

### `fetch_nara_bids`
- `numOfRows` (number, 기본 20)
- `pageNo` (number, 기본 1)
- `type` (string, 기본 "Servc"): "Servc"(용역) | "Cnstwk"(공사) | "Thng"(물품) | "Frgcpt"(외자)
- `inqryBgnDt` / `inqryEndDt` (string, YYYYMMDDHHMM): 조회 기간

### `fetch_smes_notices`
- `numOfRows` (number, 기본 20)
- `pageNo` (number, 기본 1)

## 라이선스 / 데이터

- 코드: MIT
- 데이터: 각 출처의 공공누리 / 오픈 라이선스를 따른다.
  본 패키지는 데이터 자체를 캐싱·재배포하지 않으며, 사용자가 본인 인증키로 직접 호출한다.

## 개발

```bash
git clone https://github.com/leokim90/gov-data-mcp.git
cd gov-data-mcp
npm install
cp .env.example .env   # 키 채우기
npm start              # MCP 서버 stdio 모드로 부팅
npm test               # 스모크 테스트
```

## 한도(Rate Limit)

각 출처별 일일 호출 한도는 사용자 키에 귀속된다. 발급 사이트 마이페이지에서 확인.
일반적으로 data.go.kr은 일 1,000~10,000회, 기업마당·중소벤처24는 일 1,000회 수준.

## 기여

이슈·PR 환영. https://github.com/leokim90/gov-data-mcp/issues
