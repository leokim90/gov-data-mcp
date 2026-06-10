# gov-data-mcp

## 개요

한 줄: 한국 정부 공공데이터 5종(중기부·정부24·기업마당·나라장터·중소벤처24)을 Claude에서 바로 조회하는 MCP 서버.
현재 단계: 배포 (v0.1.2, npm `@leokim90/gov-data-mcp`, Cowork 세션에 연결 운영 중)

## 스택

- Node.js 20+ / 의존성은 `@modelcontextprotocol/sdk` 1개뿐 (의도적 최소화 — 추가 금지 항목 참조)
- stdio 모드 전용 (StdioServerTransport), stdout은 MCP 프로토콜 전용 → 로그는 stderr만

## 구조

```
src/mcp-server.js   # 진입점 — 도구 6종 등록 + 핸들러
src/core/*.js       # API별 fetch 모듈 (mss-biz / gov24 / bizinfo / nara-bid / smes)
src/core/utils.js   # 정규식 기반 XML/HTML 파싱 + 10초 타임아웃 fetch
tests/              # parsing.test.js(node:test 유닛 42종) + smoke.js(graceful) + mcp-handshake.js(프로토콜)
tests/fixtures/     # 실 API 응답 픽스처(정상/깨진스키마/에러) — fetch 모킹용
```

## 도구 6종

fetch_mss_biz(중기부 공고) / fetch_gov24_services(검색) / fetch_gov24_service_detail(상세) / fetch_bizinfo_programs(기업마당) / fetch_nara_bids(나라장터 입찰) / fetch_smes_notices(중소벤처24, 마감일 자동 필터)

## API 키 (.env, 3종)

- `DATA_GO_KR_SERVICE_KEY` — data.go.kr (중기부/정부24/나라장터 공통)
- `BIZINFO_API_KEY` / `SMES_API_KEY` — 선택
- 키 미설정 시 에러 대신 `{ items: [], warning: '키_미설정' }` 반환 — **이 graceful 폴백 계약을 깨지 말 것** (ai_match 등 소비처가 빈 배열 폴백에 의존)

## 명령어

dev/start: `npm start` · test: `npm test` (유닛 42 + smoke 6 + handshake 2, 키 없어도 통과해야 정상)
클라이언트 등록(npm): `claude mcp add gov-data --env DATA_GO_KR_SERVICE_KEY=... -- npx -y @leokim90/gov-data-mcp`
클라이언트 등록(로컬소스, 미배포 수정 즉시 반영): `claude mcp add gov-data --scope user --env DATA_GO_KR_SERVICE_KEY=... -- node <repo>/src/mcp-server.js`

## 하면 안 되는 것

- 의존성 추가 금지 (XML 파서 라이브러리 포함) — "MCP SDK 1개" 경량 원칙. 파싱 문제는 utils.js 정규식 보강으로 해결
- 키 미설정 시 throw로 변경 금지 — graceful 빈 배열 계약 유지
- stdout에 console.log 금지 — MCP 프로토콜 깨짐 (stderr만)
- 결과 텍스트 500자 제한 해제 금지 — 컨텍스트 비용 방어

## 알려진 리스크 (2026-06-10 점검)

- 정부 API 스키마 변경 시 파싱이 **조용히 빈 배열로 실패**한다 — totalCount가 갑자기 0이면 스키마 변경 의심
- smes 마감일 필터: 날짜 파싱 실패(빈 값/`Invalid Date`) 항목은 필터 통과 (API 형식 신뢰) — 2026-06-10 `Invalid Date`도 통과하도록 수정
- nara: API가 `inqryDiv`+조회기간을 필수로 요구 → 미지정 시 기본 최근 30일 자동 설정. 에러 헤더(resultCode≠00)는 warning으로 표면화(조용한 실패 방지)
- 유닛 테스트: `tests/parsing.test.js`(node:test, 픽스처 기반 42종). 파싱 로직 수정 시 `tests/fixtures/`에 실API 응답 픽스처 추가 후 테스트 먼저 작성

## 배포

npm publish (버전 bump → `npm publish --access public`) · 헬스체크: `npm test` + 실도구 1회 호출(fetch_mss_biz numOfRows=3)
