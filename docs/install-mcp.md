# 설치 가이드 — MCP 클라이언트 (최종 사용자용)

Claude Desktop · Claude Code · Cursor 등 MCP 호환 클라이언트에서 정부 공공데이터를 자연어로 조회하기 위한 설치 가이드. 개발 지식 없이 따라 할 수 있다.

순서: **① API 키 발급 → ② 클라이언트에 등록 → ③ 동작 확인**

---

## ① API 키 발급

3개 사이트에서 각각 무료로 발급받는다. 회원가입 포함 사이트당 약 5~10분.
**3개 키가 모두 없어도 된다.** `DATA_GO_KR_SERVICE_KEY` 하나만 있어도 중기부·정부24·나라장터 3개 도구가 동작한다.

### 🔑 키 1 — `DATA_GO_KR_SERVICE_KEY` (중기부·정부24·나라장터 공통)

**발급처:** https://www.data.go.kr

1. 우측 상단 **회원가입** → 본인인증 후 가입
2. 로그인 후 우측 상단 **마이페이지** 클릭
3. 좌측 메뉴 **인증키 발급현황** 클릭
4. 상단 **일반 인증키(Encoding)** 항목의 키 값 복사
   - 키가 없으면 **인증키 신청** 버튼 → 자동 발급 (즉시)
5. 복사한 값을 `DATA_GO_KR_SERVICE_KEY`에 사용

> **주의:** 키는 URL 인코딩된 형태(`%2F`, `%2B` 등 포함)로 복사된다. 그대로 사용하면 된다.
> 첫 발급 후 실제 API 호출이 될 때까지 최대 1~2시간 걸릴 수 있다.
> 각 API(중기부 사업공고 / 정부24 / 나라장터 입찰)는 **활용신청**을 따로 해야 한다.

### 🔑 키 2 — `BIZINFO_API_KEY` (기업마당)

**발급처:** https://www.bizinfo.go.kr

1. 우측 상단 **회원가입** → 일반회원으로 가입
2. 로그인 후 **마이페이지** → 좌측 **오픈API 신청/관리**
3. **오픈API 신청** 버튼 → 활용 목적 입력 후 신청 (보통 즉시~수 분 내 자동 승인)
4. 승인 후 같은 페이지에서 **인증키** 복사

### 🔑 키 3 — `SMES_API_KEY` (중소벤처24)

**발급처:** https://www.smes.go.kr

1. 우측 상단 **회원가입** → 본인인증 후 가입
2. 로그인 후 **마이페이지** → 좌측 **Open API 관리**
3. **API 토큰 신청** 버튼 → 즉시 발급
4. 발급된 **토큰 값** 복사

---

## ② 클라이언트에 등록

### Claude Desktop

설정 파일을 연다.

| OS | 경로 |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

> 파일이 없으면 새로 만든다. Claude Desktop 메뉴 → Settings → Developer → **Edit Config** 버튼으로도 열린다.

아래를 붙여넣고 키만 본인 발급키로 교체:

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

### Claude Code (CLI)

터미널에서 한 줄. `--scope user`면 그 머신 모든 프로젝트에서 사용 가능.

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
| `--scope project` | 프로젝트 루트 `.mcp.json`에 저장 → 팀 공유 (키 평문 주의, `.gitignore` 필수) |

확인: `claude mcp list` → `gov-data ✔ Connected` 보이면 정상.

### Cursor · Windsurf · Cline 등

대부분 Claude Desktop과 **동일한 `mcpServers` JSON 포맷**을 쓴다. 위 JSON 블록을 각 클라이언트 MCP 설정에 그대로 넣으면 된다.

| 클라이언트 | 설정 위치 |
|-----------|-----------|
| Cursor | Settings → MCP → Add, 또는 `~/.cursor/mcp.json` (프로젝트는 `.cursor/mcp.json`) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline (VS Code) | Cline 패널 → MCP Servers → Configure |

### 서버 · 헤드리스 · Docker

GUI 없이 직접 띄울 때. 환경변수만 있으면 동작한다.

```bash
DATA_GO_KR_SERVICE_KEY=발급키 BIZINFO_API_KEY=선택 SMES_API_KEY=선택 \
  npx -y @leokim90/gov-data-mcp
```

Docker:
```dockerfile
FROM node:20-slim
RUN npm install -g @leokim90/gov-data-mcp
CMD ["gov-data-mcp"]
```
```bash
docker run -i -e DATA_GO_KR_SERVICE_KEY=발급키 your-image
```
> `-i`(stdin 유지) 필수 — stdio 트랜스포트라 표준입출력이 끊기면 통신 불가.

---

## ③ 동작 확인

- **Claude Desktop**: 채팅창 좌하단 🔨(망치) 아이콘 → `gov-data`에 도구 6개 표시되면 정상.
- **Claude Code**: 새 세션에서 `/mcp` 입력 → `gov-data ✓ connected`.
- **Cursor 등**: MCP 설정 화면에서 `gov-data`가 connected(초록불)로 표시.

> 키가 없는 도구는 자동으로 빈 배열을 반환하므로, 필요한 키만 설정해도 나머지 도구는 정상 동작한다.

## 사용 예시 (자연어)

- "오늘 중기부 사업공고 최신 10건 가져와줘"
- "기업마당에서 마감 임박 지원사업 알려줘"
- "정부24에서 '청년 창업' 키워드로 혜택 검색해줘"
- "나라장터 용역 입찰공고 최근 20건 보여줘"
