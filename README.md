# gov-data-mcp

한국 정부 공공데이터 5종을 한 번에 호출하는 MCP(Model Context Protocol) 서버.
Claude Desktop / Claude Code 등 MCP 호환 클라이언트에서 자연어로 정부 사업·공고·서비스 데이터를 가져올 수 있다.
일반 npm 라이브러리로 import해서 코드에서 직접 호출할 수도 있다.

## 제공 도구 (6종)

| 도구명 | 설명 | 출처 |
|--------|------|------|
| `fetch_mss_biz` | 중소벤처기업부 사업공고 목록 | `apis.data.go.kr/1421000/mssBizService_v2` |
| `fetch_gov24_services` | 정부24 공공서비스(혜택) 키워드 검색 | `api.odcloud.kr/api/gov24/v3` |
| `fetch_gov24_service_detail` | 정부24 서비스 상세 (신청자격·구비서류 등) | `api.odcloud.kr/api/gov24/v3` |
| `fetch_bizinfo_programs` | 기업마당 지원사업 (NIPA·KISA·중진공·TIPA 등 통합) | `bizinfo.go.kr` |
| `fetch_nara_bids` | 나라장터 입찰공고 (용역/공사/물품/외자, 키워드 검색 가능) | `apis.data.go.kr/1230000` |
| `fetch_smes_notices` | 중소벤처24 산하기관 공고 | `smes.go.kr/fnct/apiReqst/extPblancInfo` |

## 빠른 시작 (Claude Desktop)

API 키 1개([data.go.kr](https://www.data.go.kr) 무료 발급)만 있으면 중기부·정부24·나라장터 3종이 동작한다.

`~/Library/Application Support/Claude/claude_desktop_config.json` (Windows: `%APPDATA%\Claude\`)에 추가 후 재시작:

```json
{
  "mcpServers": {
    "gov-data": {
      "command": "npx",
      "args": ["-y", "@leokim90/gov-data-mcp"],
      "env": { "DATA_GO_KR_SERVICE_KEY": "여기에_발급받은_키" }
    }
  }
}
```

> 키 발급 방법, 다른 클라이언트(Claude Code/Cursor 등), 키 3종 전체는 아래 설치 가이드 참조.

## 설치·사용 가이드

| 가이드 | 대상 | 내용 |
|--------|------|------|
| **[MCP 클라이언트 설치](docs/install-mcp.md)** | 최종 사용자 | API 키 발급(3종) + Claude Desktop/Code/Cursor/Docker 등록 + 동작 확인 |
| **[npm 라이브러리 사용](docs/usage-library.md)** | 개발자 | `npm install` 후 import → 함수 시그니처·반환형·graceful 계약 |
| **[Next.js 15 사용](docs/usage-nextjs.md)** | 개발자 | App Router Route Handler / 서버 컴포넌트 예시, 키 보안·캐싱 |
| **[초기 공유 배포](docs/install-trial-share.md)** | 운영자 | 체험용 공유 키로 먼저 배포 → 나중에 개인 키로 전환 |

> 🌐 **비개발자용 웹 가이드(클릭 한 번으로 따라하기)**: **https://leokim90.github.io/gov-data-mcp/** — 키 발급 + 클라이언트 등록을 탭·복사 버튼으로 쉽게. (소스: [`docs/install.html`](docs/install.html))

## 사용 예시 (자연어)

Claude에 자연어로 요청:

- "오늘 중기부 사업공고 최신 10건 가져와줘"
- "기업마당에서 마감 임박 지원사업 알려줘"
- "정부24에서 '청년 창업' 키워드로 혜택 검색해줘"
- "나라장터 용역 입찰공고 최근 20건 보여줘"

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

### `fetch_gov24_service_detail`
- `serviceId` (string, **필수**): `fetch_gov24_services` 결과의 `serviceId` 값

### `fetch_nara_bids`
- `numOfRows` (number, 기본 20)
- `pageNo` (number, 기본 1)
- `type` (string, 기본 "Servc"): "Servc"(용역) | "Cnstwk"(공사) | "Thng"(물품) | "Frgcpt"(외자)
- `keyword` (string, 선택): 공고명 키워드 검색
- `inqryBgnDt` / `inqryEndDt` (string, YYYYMMDDHHMM): 조회 기간 (미지정 시 최근 30일 자동)

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
npm test               # 유닛(파싱)+스모크+핸드셰이크 테스트
```

## 한도(Rate Limit)

각 출처별 일일 호출 한도는 사용자 키에 귀속된다. 발급 사이트 마이페이지에서 확인.
일반적으로 data.go.kr은 일 1,000~10,000회, 기업마당·중소벤처24는 일 1,000회 수준.

## 기여

이슈·PR 환영. https://github.com/leokim90/gov-data-mcp/issues
