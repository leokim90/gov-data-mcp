# 사용 가이드 — Next.js 15 (App Router)

키는 **서버에만** 두고, 클라이언트는 내 API route(또는 서버 컴포넌트)만 거치는 구조. 라이브러리 기본 사용법은 [라이브러리 가이드](usage-library.md) 참조.

## 1. 환경변수 (`.env.local` — 서버 전용)

```bash
DATA_GO_KR_SERVICE_KEY=발급키
BIZINFO_API_KEY=선택
SMES_API_KEY=선택
```

> `NEXT_PUBLIC_` 접두사 **금지** — 붙이면 브라우저로 키가 노출된다.

## 2. Route Handler — 중기부 공고 (`app/api/gov/mss/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchMssBizList } from '@leokim90/gov-data-mcp';

// 패키지가 내장 fetch/fs(ESM)를 쓰므로 Node 런타임 고정 (edge 아님)
export const runtime = 'nodejs';
// 매 요청마다 최신 공고 조회 — 캐시 비활성화
export const dynamic = 'force-dynamic';

// GET /api/gov/mss?numOfRows=10&pageNo=1
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const numOfRows = Number(searchParams.get('numOfRows') ?? 20);
  const pageNo = Number(searchParams.get('pageNo') ?? 1);

  // 라이브러리는 throw하지 않고 항상 {items, warning?/error?} 반환 (graceful)
  const result = await fetchMssBizList({ numOfRows, pageNo });

  // 키 미설정/에러는 502로 표면화 (조용한 빈 배열 방지)
  if (result.error || result.warning) {
    return NextResponse.json(
      { items: [], message: result.error ?? result.warning },
      { status: 502 },
    );
  }

  return NextResponse.json({ totalCount: result.totalCount, items: result.items });
}
```

## 3. 쿼리 파라미터 받기 — 정부24 검색 (`app/api/gov/services/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchGov24ServiceList } from '@leokim90/gov-data-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/gov/services?keyword=청년창업&perPage=10
export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword');

  // keyword는 필수 — 없으면 400
  if (!keyword) {
    return NextResponse.json({ message: 'keyword 파라미터 필요' }, { status: 400 });
  }

  const perPage = Number(req.nextUrl.searchParams.get('perPage') ?? 20);
  const result = await fetchGov24ServiceList({ keyword, perPage });

  return NextResponse.json({
    totalCount: result.totalCount,
    items: result.items,
    ...(result.warning ? { warning: result.warning } : {}),
  });
}
```

## 4. 클라이언트에서 호출

```tsx
'use client';

async function search(keyword: string) {
  const res = await fetch(`/api/gov/services?keyword=${encodeURIComponent(keyword)}`);
  const data = await res.json();
  return data.items; // 항상 배열
}
```

## 5. 서버 컴포넌트에서 직접 호출 (API route 불필요)

서버 컴포넌트는 서버에서 실행되므로 키가 안전하다. API route 없이 바로 import하면 네트워크 홉도 준다.

```tsx
// app/page.tsx (서버 컴포넌트)
import { fetchNaraBidList } from '@leokim90/gov-data-mcp';

export default async function Page() {
  const { items } = await fetchNaraBidList({ numOfRows: 10 });
  return (
    <ul>
      {items.map((b) => (
        <li key={b.bidNtceNo}>{b.bidNtceNm}</li>
      ))}
    </ul>
  );
}
```

## 6. 주의

- **타입 선언 없음**: `types/gov-data-mcp.d.ts`에 `declare module '@leokim90/gov-data-mcp';` 추가하면 TS 경고 해소.
- **캐싱**: 위 예시는 `force-dynamic`으로 항상 실시간. 일정 시간 캐시하려면 route에 `export const revalidate = 600;`(초) 적용. 캐시 동작은 route 레벨 설정으로 잡는 게 명확하다.
- **런타임**: `runtime = 'nodejs'` 고정 권장 (edge에서 패키지 동작 보장 안 함).
