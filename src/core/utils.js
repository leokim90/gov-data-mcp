// --- 공통 유틸리티 ---

// XML 태그 값 추출 (CDATA + 일반 텍스트 모두 처리)
export function extractTag(xml, tag) {
  // 태그명을 이스케이프하여 정확히 일치하는 태그만 추출
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<${escaped}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${escaped}>|<${escaped}>([^<]*)</${escaped}>`,
  );
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : '';
}

// HTML 태그 제거 + HTML 엔티티 정규화
export function stripHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x[0-9a-fA-F]+;/g, '')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 날짜 포맷: YYYYMMDD → YYYY-MM-DD (이미 ISO 형식이면 그대로 반환)
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.replace(/[-/]/g, '');
  if (clean.length >= 8 && /^\d{8}/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return dateStr;
}

// AbortController 기반 타임아웃 fetch (기본 10초)
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`요청 타임아웃 (${timeoutMs / 1000}초 초과): ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
