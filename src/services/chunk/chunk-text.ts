type TChunkTextContent = {
  text: string;
  index: number;
};

type TChunkTextContentOptions = {
  maxChars?: number;
  overlapChars?: number;
  minChars?: number;
  cleanText?: boolean;

  // 토큰 기반 (선택)
  maxTokens?: number;
  overlapTokens?: number;
  minTokens?: number;
  tokenCounter?: (text: string) => number;
};

export function chunkTextContent(
  content: string,
  {
    maxChars = 800,
    overlapChars = 100,
    minChars = 200,
    cleanText = true,

    maxTokens,
    overlapTokens,
    minTokens,
    tokenCounter,
  }: TChunkTextContentOptions = {},
): TChunkTextContent[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  // 0) 전처리
  const text = cleanText
    ? content.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim()
    : content;

  // 1) 길이 측정자
  const useTokens = !!(tokenCounter && (maxTokens || overlapTokens || minTokens));
  const lengthOf = (t: string) => (useTokens ? tokenCounter!(t) : t.length);

  const maxBudget = useTokens ? (maxTokens ?? 700) : maxChars;
  const rawOverlap = useTokens ? (overlapTokens ?? 80) : overlapChars;
  const minBudget = useTokens ? (minTokens ?? 150) : minChars;

  // 안전 가드: 오버랩은 항상 maxBudget-1 이하
  const safeOverlap = Math.max(0, Math.min(rawOverlap, Math.max(0, maxBudget - 1)));

  const chunks: TChunkTextContent[] = [];

  // 2) 문장 분리 개선 (인용부호 여러 개 대응)
  const SENT_SPLIT = /(?<=[.!?]["'"]*)\s+|(?<=[.!?]["'"]*)(?=[A-Z])/g;
  const sentences = text.split(SENT_SPLIT).map((s) => s.trim()).filter(Boolean);

  // 2-1) 문장 분리가 어려운 텍스트면 문자 슬라이싱 폴백
  if (sentences.length < 2 && lengthOf(text) > maxBudget) {
    const step = Math.max(1, maxBudget - safeOverlap);
    for (let start = 0; start < text.length; start += step) {
      const end = Math.min(start + maxBudget, text.length);
      const slice = text.slice(start, end).trim();
      if (!slice) continue;
      if (chunks.length === 0 || chunks[chunks.length - 1].text !== slice) {
        chunks.push({ text: slice, index: chunks.length });
      }
      if (end >= text.length) break;
    }
    return chunks;
  }

  // 3) 문장 단위 청킹 (while 루프 방식으로 개선)
  const MAX_OVERLAP_RATIO = 0.3;
  const joinSents = (arr: string[]) => arr.join(" ").trim();

  let i = 0;

  while (i < sentences.length) {
    const chunkSentences: string[] = [];
    let chunkLength = 0;
    let j = i;

    // 현재 청크 채우기
    while (j < sentences.length) {
      const nextSent = sentences[j];
      const testText = [...chunkSentences, nextSent].join(" ");
      const testLength = lengthOf(testText);

      if (chunkSentences.length > 0 && testLength > maxBudget) {
        if (chunkLength >= minBudget) {
          break; // 이 문장은 다음 청크로
        }
      }

      chunkSentences.push(nextSent);
      chunkLength = testLength;
      j++;
    }

    // 청크 저장
    if (chunkSentences.length > 0) {
      const chunkText = joinSents(chunkSentences);
      // 중복 체크
      const lastChunk = chunks[chunks.length - 1];
      if (!lastChunk || lastChunk.text !== chunkText) {
        chunks.push({
          text: chunkText,
          index: chunks.length,
        });
      }
    }

    // 모든 문장 처리 완료
    if (j >= sentences.length) {
      break;
    }

    // 오버랩 계산
    let overlapLength = 0;
    let overlapCount = 0;
    const clampedOverlap = Math.min(
      safeOverlap,
      Math.floor(chunkLength * MAX_OVERLAP_RATIO)
    );

    for (let k = chunkSentences.length - 1; k >= 0; k--) {
      const sentLen = lengthOf(chunkSentences[k]);
      if (overlapLength + sentLen > clampedOverlap) break;
      overlapLength += sentLen + 1;
      overlapCount++;
    }

    // 다음 시작점 (무한루프 방지)
    i = Math.max(j - overlapCount, i + 1);
  }

  // 폴백: 청크가 없으면 전체를 하나로
  if (chunks.length === 0 && text.trim()) {
    chunks.push({ text: text.trim(), index: 0 });
  }

  return chunks;
}