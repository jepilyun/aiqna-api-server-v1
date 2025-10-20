const MAX_META_TEXT = 1200; // 메타데이터에 저장할 스니펫 최대 길이

export function toSnippet(s: string, n = MAX_META_TEXT) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return (last > n * 0.6 ? cut.slice(0, last + 1) : cut) + " …";
}


// (선택) 임베딩에 쓸 텍스트도 안전하게 자르기
export function safeForEmbedding(s: string, n = 1200) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return last > n * 0.6 ? cut.slice(0, last + 1) : cut;
}
