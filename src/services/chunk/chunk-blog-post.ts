// blog-post/chunk-blog-post-content.ts

type TChunkBlogPostContent = {
  text: string;
  index: number;
};

type TChunkBlogPostContentOptions = {
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

/**
 * Blog Post 콘텐츠를 청크로 분할 (개선 버전)
 * @param content
 * @param options
 * @returns
 */
export function chunkBlogPostContent(
  content: string,
  {
    maxChars = 800, // ✅ 800자로 줄임
    overlapChars = 100, // ✅ 100자로 줄임
    minChars = 200, // ✅ 200자로 줄임
    cleanText = true,

    maxTokens,
    overlapTokens,
    minTokens,
    tokenCounter,
  }: TChunkBlogPostContentOptions = {},
): TChunkBlogPostContent[] {
  if (!content || content.trim().length === 0) return [];

  // 전처리: 공백 정리
  let text = content;
  if (cleanText) {
    text = text.replace(/\s+/g, " ").trim();
  }

  // 토큰 기반 vs 문자 기반
  const useTokens = !!(
    tokenCounter &&
    (maxTokens || overlapTokens || minTokens)
  );
  const lengthOf = (t: string) => (useTokens ? tokenCounter!(t) : t.length);

  const maxBudget = useTokens ? (maxTokens ?? 700) : maxChars;
  const overlapBudget = Math.min(
    useTokens ? (overlapTokens ?? 80) : overlapChars,
    maxBudget,
  );
  const minBudget = useTokens ? (minTokens ?? 150) : minChars;

  const chunks: TChunkBlogPostContent[] = [];

  // ✅ 개선된 문장 분리: 마침표/느낌표/물음표 뒤 공백 기준
  const sentences = text
    .split(/([.!?]+\s*)/) // \s+ → \s* (공백 0개 이상)
    .reduce((acc: string[], curr, idx, arr) => {
      if (idx % 2 === 0 && curr.trim()) {
        const punctuation = arr[idx + 1] || "";
        acc.push(curr + punctuation);
      }
      return acc;
    }, [])
    .filter((s) => s.trim());

  // 문장이 없으면 강제로 분할
  if (sentences.length === 0) {
    sentences.push(text);
  }

  let currentChunk = "";
  let currentLength = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLength = lengthOf(sentence);
    const candidateLength = currentLength + sentenceLength;

    // 현재 청크 + 새 문장이 최대 크기를 초과하는 경우
    if (currentChunk && candidateLength > maxBudget) {
      // 현재 청크가 최소 크기를 만족하면 저장
      if (currentLength >= minBudget) {
        const trimmedChunk = currentChunk.trim();
        chunks.push({
          text: trimmedChunk,
          index: chunks.length,
        });

        // ✅ 개선된 Overlap: 문자 기반으로 정확히 자르기
        const overlapStart = Math.max(0, trimmedChunk.length - overlapBudget);
        const overlapText = trimmedChunk.substring(overlapStart);

        currentChunk = overlapText + " " + sentence;
        currentLength = lengthOf(currentChunk);
      } else {
        // 최소 크기 미만이면 계속 누적
        currentChunk += " " + sentence;
        currentLength = candidateLength;
      }
    } else {
      // 아직 예산 내이면 계속 누적
      currentChunk += (currentChunk ? " " : "") + sentence;
      currentLength = candidateLength;
    }
  }

  // 마지막 청크 추가
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunks.length,
    });
  }

  // 청크가 없는 경우 전체를 하나의 청크로
  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      text: text.trim(),
      index: 0,
    });
  }

  return chunks;
}
