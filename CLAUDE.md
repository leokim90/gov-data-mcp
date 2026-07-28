# gov-data-mcp

## 개요

한 줄: 한국 정부 공공데이터 5종(중기부·정부24·기업마당·나라장터·중소벤처24)을 Claude에서 바로 조회하는 MCP 서버.
현재 단계: 배포 (v0.1.2, npm `@leokim90/gov-data-mcp`, Cowork 세션에 연결 운영 중)

## 스택

- Node.js 20+ / 의존성은 `@modelcontextprotocol/sdk` + `express`(HTTP 진입점용) 2개 (의도적 최소화 — 추가 금지 항목 참조)
- 진입점 2종: stdio(`mcp-server.js`, 로컬/npm 사용자용) + Streamable HTTP(`http-server.js`, 원격 배포용). stdout은 MCP 프로토콜 전용 → 로그는 stderr만 (HTTP 모드도 동일)

## 구조

```
src/tools.js        # 도구 6종 정의 + callTool 디스패처(캐시·stderr 로그) — 두 진입점이 공유
src/mcp-server.js   # stdio 진입점 (로컬/npm)
src/http-server.js  # HTTP 진입점 (Streamable HTTP, AUTH_TOKEN+AUTH_TOKENS 다중 토큰, /healthz 라벨별 사용량)
src/env.js          # .env 폴백 로더 (기존 env 우선, dotenv 미사용)
src/core/*.js       # API별 fetch 모듈 (mss-biz / gov24 / bizinfo / nara-bid / smes)
src/core/utils.js   # 정규식 기반 XML/HTML 파싱 + 10초 타임아웃 fetch + 쿼터 검사 훅
src/core/cache.js   # 인메모리 TTL 캐시 (공용 키 쿼터 보호)
src/core/usage.js   # 일일 사용량 카운터 (datago 8000 / bizinfo·smes 1000, KST 리셋)
tests/              # parsing.test.js(유닛 42) + cache-usage.test.js(유닛 6) + smoke.js + mcp-handshake.js + http-handshake.js
tests/fixtures/     # 실 API 응답 픽스처(정상/깨진스키마/에러) — fetch 모킹용
```

## 도구 6종

fetch_mss_biz(중기부 공고) / fetch_gov24_services(검색) / fetch_gov24_service_detail(상세) / fetch_bizinfo_programs(기업마당) / fetch_nara_bids(나라장터 입찰) / fetch_smes_notices(중소벤처24, 마감일 자동 필터)

## API 키 (.env, 3종)

- `DATA_GO_KR_SERVICE_KEY` — data.go.kr (중기부/정부24/나라장터 공통)
- `BIZINFO_API_KEY` / `SMES_API_KEY` — 선택
- HTTP 모드 인증: `AUTH_TOKEN`(관리자, 'default' 라벨) + `AUTH_TOKENS`(부서별, `라벨:토큰` 콤마 구분, 2026-07-28 추가) 병행. 라벨별 호출 수는 `/healthz`의 `clients`로 노출 (KST 리셋). 형식 오류·라벨 중복은 기동 거부
- 키 미설정 시 에러 대신 `{ items: [], warning: '키_미설정' }` 반환 — **이 graceful 폴백 계약을 깨지 말 것** (ai_match 등 소비처가 빈 배열 폴백에 의존)

## 명령어

dev/start: `npm start` (stdio) · `npm run start:http` (HTTP, AUTH_TOKEN 필수) · test: `npm test` (유닛 48 + smoke 6 + stdio/HTTP 핸드셰이크, 키 없어도 통과해야 정상)
클라이언트 등록(npm): `claude mcp add gov-data --env DATA_GO_KR_SERVICE_KEY=... -- npx -y @leokim90/gov-data-mcp`
클라이언트 등록(로컬소스, 미배포 수정 즉시 반영): `claude mcp add gov-data --scope user --env DATA_GO_KR_SERVICE_KEY=... -- node <repo>/src/mcp-server.js`

## 하면 안 되는 것

- 의존성 추가 금지 (XML 파서 라이브러리 포함) — 경량 원칙. 허용된 예외는 SDK + express(HTTP 진입점, 2026-07-22 원격 배포 스펙) 2개뿐. 파싱 문제는 utils.js 정규식 보강으로 해결
- HTTP 서버를 토큰(AUTH_TOKEN/AUTH_TOKENS) 없이 기동 가능하게 변경 금지 — 공용 키 무인증 공개 방지 (기동 거부가 의도된 동작)
- 기존 AUTH_TOKEN('default' 라벨) 하위호환 제거 금지 — 이미 배포된 토큰·커넥터 등록이 이에 의존
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

## 고도화 백로그

1. **원격 배포 전환**: `~/workspace/mcp-remote-deploy-spec.md` 스펙 참조. **완료 (2026-07-22)**
   - ✅ 코드 구현: tools.js 추출 + http-server.js(Streamable HTTP, 토큰 인증 2방식) + 캐시/사용량 카운터 + Dockerfile + 테스트 2종. sangkwon-mcp 패턴 동일 적용
   - ✅ Cloudtype 배포: `https://port-0-gov-data-mcp-mrvnrogm068d6cba.sel3.cloudtype.app` (서울 리전 gke-seoul-3, node@22 프리셋, 프리티어 0.5GB). **프리티어는 프로젝트 1개 제한이라 sangkwon-mcp 프로젝트 안에 서비스로 공존** (서비스 4개까지 가능)
   - ✅ 검증: healthz / 잘못된 토큰 401 / initialize / data.go.kr 실호출 성공(국내 IP라 차단 없음) / 2회차 캐시히트(usage 1 고정 + cacheEntries 1)
   - 재배포: `ctype apply -f <yaml>` (스테이지 `@thepoi112/sangkwon-mcp:main`). AUTH_TOKEN·키는 Cloudtype 콘솔 서비스 설정에서 조회
   - ✅ 부서 배포 준비 (2026-07-28): AUTH_TOKENS 다중 토큰(라벨별 발급/회수/사용량) + 온보딩 안내문 `docs/team-onboarding.md`. 활성화하려면 Cloudtype 콘솔에 `AUTH_TOKENS=부서:토큰,...` 추가 후 재배포
   - ⬜ 남은 것: Cloudtype에 AUTH_TOKENS 반영·재배포 + 부서별 커넥터 실등록
   - 주의: 프리티어 리소스는 매일 1회 중지·재시작 → 인메모리 캐시/사용량 카운터 리셋 (허용된 트레이드오프)
