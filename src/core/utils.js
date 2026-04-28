// --- 공통 유틸리티 ---

// XML 태그 값 추출 (CDATA + 일반 텍스트 모두 처리)
export function extractTag(xml, tag) {
  const regex = new RegExp(
    `<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}>([^<]*)</${tag}>`,
  );
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : '';
}

// HTML 태그 제거 + 흔한 엔티티 정규화
export function stripHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

// 날짜 포맷: YYYYMMDD → YYYY-MM-DD
export function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 8) return dateStr;
  const clean = dateStr.replace(/[-/]/g, '');
  if (clean.length >= 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return dateStr;
}
