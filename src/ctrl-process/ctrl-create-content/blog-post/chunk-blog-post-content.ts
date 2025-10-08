// blog-post/chunk-blog-post-content.ts

type ChunkBlogPostContent = { 
  text: string; 
  index: number;
};

type ChunkBlogPostContentOptions = {
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
 * Blog Post 콘텐츠를 청크로 분할
 */
export function chunkBlogPostContent(
  content: string,
  {
    maxChars = 1000,
    overlapChars = 200,
    minChars = 400,
    cleanText = true,
    
    maxTokens,
    overlapTokens,
    minTokens,
    tokenCounter,
  }: ChunkBlogPostContentOptions = {},
): ChunkBlogPostContent[] {
  if (!content || content.trim().length === 0) return [];

  // 전처리: 공백 정리
  let text = content;
  if (cleanText) {
    text = text
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 토큰 기반 vs 문자 기반
  const useTokens = !!(tokenCounter && (maxTokens || overlapTokens || minTokens));
  const lengthOf = (t: string) => useTokens ? tokenCounter!(t) : t.length;

  const maxBudget = useTokens ? (maxTokens ?? 900) : maxChars;
  const overlapBudget = Math.min(
    useTokens ? (overlapTokens ?? 180) : overlapChars,
    maxBudget
  );
  const minBudget = useTokens
    ? (minTokens ?? Math.round(minChars / 4))
    : minChars;

  const chunks: ChunkBlogPostContent[] = [];
  
  // 문장 단위로 분리 (마침표, 느낌표, 물음표 기준)
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  
  let currentChunk = '';
  let currentLength = 0;

  for (const sentence of sentences) {
    const sentenceLength = lengthOf(sentence);
    const candidateLength = currentLength + sentenceLength;

    // 현재 청크 + 새 문장이 최대 크기를 초과하는 경우
    if (currentChunk && candidateLength > maxBudget) {
      // 현재 청크가 최소 크기를 만족하면 저장
      if (currentLength >= minBudget) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length,
        });

        // 겹침(overlap) 처리: 현재 청크 끝부분 일부를 다음 청크에 포함
        const words = currentChunk.split(' ');
        let overlapText = '';
        let overlapLen = 0;
        
        for (let i = words.length - 1; i >= 0; i--) {
          const word = words[i] + ' ';
          const wordLen = lengthOf(word);
          if (overlapLen + wordLen <= overlapBudget) {
            overlapText = word + overlapText;
            overlapLen += wordLen;
          } else {
            break;
          }
        }

        currentChunk = overlapText + sentence;
        currentLength = lengthOf(currentChunk);
      } else {
        // 최소 크기 미만이면 계속 누적
        currentChunk += sentence;
        currentLength = candidateLength;
      }
    } else {
      // 아직 예산 내이면 계속 누적
      currentChunk += sentence;
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