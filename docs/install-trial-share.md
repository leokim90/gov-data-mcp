# 초기 공유 가이드 — 체험용 공유 키 배포

소수의 사람에게 **운영자 키를 미리 채워** 먼저 써보게 하고, 나중에 각자 키로 전환시키는 운영 방법.

> ⚠️ **이 문서에는 실제 키를 넣지 말 것.** 이 파일은 깃/npm에 공개된다.
> 키가 채워진 실제 배포본은 **로컬 전용 파일**(`share-config.local.md`, `.gitignore` 처리됨)에서 생성·관리한다.

## 운영 방식

1. **키 1개를 공유용으로 정한다.**
   - 권장: 개인용과 분리된 **별도 data.go.kr 키**를 하나 더 발급. 나중에 그 키만 폐기하면 받은 사람 전원이 자동 차단되고, 내 개인 설정은 영향 없음.
   - 현재 쓰는 키를 그대로 공유하면: 전환 시 그 키를 재발급해야 하는데 **내 본인 설정(.env·MCP 등록)도 같이 끊긴다** → 내 쪽도 새 키로 교체 필요.

2. **받는 사람에게 아래 템플릿을 1:1로 전달** (카톡/메일). 공개 채널(블로그·깃허브·오픈채팅) 금지 — 키 노출.

3. **전환 시점**: 각자 [MCP 설치 가이드](install-mcp.md)의 키 발급 안내를 주고, 그 후 공유 키를 **재발급(폐기)** → 기존 키 무효화.

> data.go.kr 키는 **일일 호출 한도가 키 단위로 합산**된다. 공유 인원이 늘면 금방 소진/차단되므로 소수·단기로만.

---

## 받는 사람용 템플릿 (`여기에_공유키`를 실제 키로 채워 전달)

> 운영자는 이 블록을 복사한 뒤 `여기에_공유키`만 실제 키로 바꿔 전달한다.
> (키 채운 버전은 `share-config.local.md`에서 자동 생성됨)

안녕하세요 :)

제가 만든 **gov-data-mcp**(한국 정부 공공데이터를 Claude에서 바로 조회하는 도구)를 먼저 써보시라고 공유드려요. 중기부 사업공고·정부24 혜택·나라장터 입찰을 자연어로 물어보면 됩니다.

키를 미리 채워뒀으니 아래 설정만 넣으면 바로 동작합니다. **체험용 공유 키라, 정식으로 쓰실 분께는 추후 개인 키 발급 방법을 따로 안내드릴게요.**

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json` (Windows: `%APPDATA%\Claude\`)에 추가:

```json
{
  "mcpServers": {
    "gov-data": {
      "command": "npx",
      "args": ["-y", "@leokim90/gov-data-mcp"],
      "env": {
        "DATA_GO_KR_SERVICE_KEY": "여기에_공유키"
      }
    }
  }
}
```
저장 후 Claude Desktop 완전 종료(Cmd+Q) 후 재시작.

**Claude Code (CLI)**:
```bash
claude mcp add gov-data --scope user \
  --env DATA_GO_KR_SERVICE_KEY=여기에_공유키 \
  -- npx -y @leokim90/gov-data-mcp
```

**Cursor 등**: 위 JSON 블록을 해당 클라이언트 MCP 설정에 그대로 넣으세요.

동작 확인: 도구 목록에 `fetch_mss_biz`, `fetch_gov24_services`, `fetch_nara_bids` 등이 보이면 정상입니다. (중기부·정부24·나라장터 3종이 이 키로 동작합니다.)
