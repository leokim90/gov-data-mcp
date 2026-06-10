# gov-data-mcp

한국 정부 공공데이터 5종을 한 번에 호출하는 MCP(Model Context Protocol) 서버.
Claude Desktop / Claude Code 등 MCP 호환 클라이언트에서 자연어로 정부 사업·공고·서비스 데이터를 가져올 수 있다.

## 제공 도구 (6종)

| 도구명 | 설명 | 출처 |
|--------|------|------|
| `fetch_mss_biz` | 중소벤처기업부 사업공고 목록 | `apis.data.go.kr/1421000/mssBizService_v2` |
| `fetch_gov24_services` | 정부24 공공서비스(혜택) 키워드 검색 | `api.odcloud.kr/api/gov24/v3` |
| `fetch_gov24_service_detail` | 정부24 서비스 상세 (신청자격·구비서류 등) | `api.odcloud.kr/api/gov24/v3` |
| `fetch_bizinfo_programs` | 기업마당 지원사업 (NIPA·KISA·중진공·TIPA 등 통합) | `bizinfo.go.kr` |
| `fetch_nara_bids` | 나라장터 입찰공고 (용역/공사/물품/외자, 키워드 검색 가능) | `apis.data.go.kr/1230000` |
| `fetch_smes_notices` | 중소벤처24 산하기관 공고 | `smes.go.kr/fnct/apiReqst/extPblancInfo` |

## 설치

### 1. API 키 발급

3개 사이트에서 각각 무료로 발급받는다. 회원가입 포함 사이트당 약 5~10분.

---

#### 🔑 키 1 — `DATA_GO_KR_SERVICE_KEY` (중기부·정부24·나라장터 공통)

**발급처:** https://www.data.go.kr

1. 우측 상단 **회원가입** → 본인인증 후 가입
2. 로그인 후 우측 상단 **마이페이지** 클릭
3. 좌측 메뉴 **인증키 발급현황** 클릭
4. 상단 **일반 인증키(Encoding)** 항목의 키 값 복사
   - 키가 없으면 **인증키 신청** 버튼 → 자동 발급 (즉시)
5. 복사한 값을 `DATA_GO_KR_SERVICE_KEY`에 붙여넣기

> **주의:** 키는 URL 인코딩된 형태(`%2F`, `%2B` 등 포함)로 복사된다. 그대로 사용하면 된다.
> 첫 발급 후 실제 API 호출이 될 때까지 최대 1~2시간 걸릴 수 있다.

---

#### 🔑 키 2 — `BIZINFO_API_KEY` (기업마당)

**발급처:** https://www.bizinfo.go.kr

1. 우측 상단 **회원가입** → 일반회원으로 가입
2. 로그인 후 우측 상단 **마이페이지** 클릭
3. 좌측 메뉴 **오픈API 신청/관리** 클릭
4. **오픈API 신청** 버튼 → 활용 목적 입력 후 신청
5. 승인 완료 후 같은 페이지에서 **인증키** 복사
   - 승인은 보통 즉시~수 분 내 자동 승인

---

#### 🔑 키 3 — `SMES_API_KEY` (중소벤처24)

**발급처:** https://www.smes.go.kr

1. 우측 상단 **회원가입** → 본인인증 후 가입
2. 로그인 후 우측 상단 **마이페이지** 클릭
3. 좌측 메뉴 **Open API 관리** 클릭
4. **API 토큰 신청** 버튼 클릭 → 즉시 발급
5. 발급된 **토큰 값** 복사 → `SMES_API_KEY`에 붙여넣기

---

> **3개 키가 모두 없어도 된다.** 키가 없는 API는 빈 배열을 반환하며, 나머지 API는 정상 동작한다.
> 예: `DATA_GO_KR_SERVICE_KEY`만 있어도 중기부·정부24·나라장터 3개 도구를 사용할 수 있다.

### 2-A. Claude Desktop에 등록

설정 파일을 연다.

| OS | 경로 |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

> 파일이 없으면 새로 만든다.
> Claude Desktop 메뉴 → Settings → Developer → **Edit Config** 버튼으로도 자동 열림.

아래 내용을 붙여넣고 키 3곳만 본인 발급키로 교체:

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

저장 후 **Claude Desktop 완전 종료(Cmd+Q) → 재시작.**

### 2-B. Claude Code에 등록

터미널에서 한 줄. `--scope user`를 주면 **그 머신의 모든 프로젝트**에서 쓸 수 있다.

```bash
claude mcp add gov-data --scope user \
  --env DATA_GO_KR_SERVICE_KEY=발급받은키 \
  --env BIZINFO_API_KEY=발급받은키 \
  --env SMES_API_KEY=발급받은키 \
  -- npx -y @leokim90/gov-data-mcp
```

| scope | 적용 범위 |
|-------|-----------|
| `--scope user` | 그 머신의 모든 프로젝트 (권장) |
| `--scope local` (기본) | 현재 프로젝트 디렉토리에서만 |
| `--scope project` | 프로젝트 루트 `.mcp.json`에 저장 → 팀 공유 (키 평문 주의) |

확인:

```bash
claude mcp list
```

→ 출력에 `gov-data ✔ Connected` 있으면 정상.

특정 프로젝트에서만 쓰려면 프로젝트 루트에 `.mcp.json` 파일로도 가능 (구조는 위 Claude Desktop JSON과 동일). 단, 키가 평문으로 들어가므로 **`.gitignore`에 `.mcp.json` 추가 필수.**

### 2-C. Cursor · Windsurf · Cline · 기타 MCP 클라이언트

대부분의 MCP 클라이언트는 Claude Desktop과 **동일한 `mcpServers` JSON 포맷**을 쓴다. 각 클라이언트의 MCP 설정 파일에 2-A의 JSON 블록을 그대로 넣으면 된다.

| 클라이언트 | 설정 위치 |
|-----------|-----------|
| Cursor | Settings → MCP → Add, 또는 `~/.cursor/mcp.json` (프로젝트는 `.cursor/mcp.json`) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline (VS Code) | Cline 패널 → MCP Servers → Configure, 또는 `cline_mcp_settings.json` |
| 기타 | "MCP 서버 추가" 메뉴에서 `command: npx`, `args: ["-y", "@leokim90/gov-data-mcp"]`, `env`에 키 |

> 클라이언트마다 키는 같은 `env` 객체에 넣는다. 포맷이 약간 달라도 `command`/`args`/`env` 3요소는 공통이다.

### 2-D. 서버 · 헤드리스 · Docker 환경

GUI 없이 직접 띄우거나 다른 호스트에서 구동할 때. stdio 서버이므로 MCP 클라이언트가 자식 프로세스로 실행하는 게 기본이지만, 환경변수만 있으면 어디서든 동작한다.

```bash
# 환경변수로 직접 실행 (stdio — MCP 클라이언트가 stdin/stdout으로 연결)
DATA_GO_KR_SERVICE_KEY=발급키 \
BIZINFO_API_KEY=선택 \
SMES_API_KEY=선택 \
npx -y @leokim90/gov-data-mcp
```

Docker 등 컨테이너에서 쓰려면 Node 20+ 이미지에 키를 `-e`로 주입:

```dockerfile
FROM node:20-slim
# 전역 설치로 bin을 이미지에 미리 받아둔다 (첫 실행 지연 제거)
RUN npm install -g @leokim90/gov-data-mcp
CMD ["gov-data-mcp"]
```
```bash
docker run -i \
  -e DATA_GO_KR_SERVICE_KEY=발급키 \
  -e BIZINFO_API_KEY=선택 \
  -e SMES_API_KEY=선택 \
  your-image
```

> `-i`(stdin 유지) 필수 — stdio 트랜스포트라 표준입출력이 끊기면 통신 불가.
> 로그는 stderr로만 나가고 stdout은 MCP 프로토콜 전용이다.

### 2-E. 동작 확인

- **Claude Desktop**: 채팅창 좌하단 🔨(망치) 아이콘 클릭 → `gov-data` 항목에 도구 6개(`fetch_mss_biz`, `fetch_gov24_services`, `fetch_gov24_service_detail`, `fetch_bizinfo_programs`, `fetch_nara_bids`, `fetch_smes_notices`) 표시되면 정상.
- **Claude Code**: 새 세션 열고 `/mcp` 입력 → `gov-data ✓ connected` 떠야 정상.
- **Cursor 등**: MCP 설정 화면에서 `gov-data`가 초록불/connected로 표시되면 정상.

> 키가 없는 도구는 자동으로 빈 배열을 반환하므로, 필요한 키만 설정해도 나머지 도구는 정상 동작한다.

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

### `fetch_gov24_service_detail`
- `serviceId` (string, **필수**): `fetch_gov24_services` 결과의 `serviceId` 값

### `fetch_nara_bids`
- `numOfRows` (number, 기본 20)
- `pageNo` (number, 기본 1)
- `type` (string, 기본 "Servc"): "Servc"(용역) | "Cnstwk"(공사) | "Thng"(물품) | "Frgcpt"(외자)
- `keyword` (string, 선택): 공고명 키워드 검색
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
npm test               # 유닛(파싱)+스모크+핸드셰이크 테스트
```

## 한도(Rate Limit)

각 출처별 일일 호출 한도는 사용자 키에 귀속된다. 발급 사이트 마이페이지에서 확인.
일반적으로 data.go.kr은 일 1,000~10,000회, 기업마당·중소벤처24는 일 1,000회 수준.

## 기여

이슈·PR 환영. https://github.com/leokim90/gov-data-mcp/issues
