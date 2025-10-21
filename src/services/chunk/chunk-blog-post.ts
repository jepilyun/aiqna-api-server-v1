type TChunkBlogPostContent = {
  text: string;
  index: number;
};

type TChunkBlogPostContentOptions = {
  maxChars?: number;
  overlapChars?: number;
  minChars?: number;
  cleanText?: boolean;
  maxTokens?: number;
  overlapTokens?: number;
  minTokens?: number;
  tokenCounter?: (text: string) => number;
};

export function chunkBlogPostContent(
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
  }: TChunkBlogPostContentOptions = {},
): TChunkBlogPostContent[] {
  if (!content || content.trim().length === 0) return [];

  // ✅ 전처리: 여기서 만든 text를 아래에서 실제로 사용
  const text = cleanText ? content.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim() : content;

  const useTokens = !!tokenCounter && !!(maxTokens || overlapTokens || minTokens);
  const lengthOf = (t: string) => (useTokens ? tokenCounter!(t) : t.length);

  const maxBudget = useTokens ? (maxTokens ?? 700) : maxChars;
  const overlapBudget = useTokens ? (overlapTokens ?? 80) : overlapChars;
  const minBudget = useTokens ? (minTokens ?? 150) : minChars;

  // 문장 분리
  const SENT_SPLIT = /(?<=[.!?])\s+|(?<=[.!?])(?=[A-Z])/g;
  const sentences = text
    .split(SENT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: TChunkBlogPostContent[] = [];
  let i = 0;

  while (i < sentences.length) {
    const chunkSentences: string[] = [];
    let chunkLength = 0;
    let j = i;

    while (j < sentences.length) {
      const nextSent = sentences[j];
      const testText = [...chunkSentences, nextSent].join(" ");
      const testLength = lengthOf(testText);

      if (chunkSentences.length > 0 && testLength > maxBudget) {
        if (chunkLength >= minBudget) break;
      }

      chunkSentences.push(nextSent);
      chunkLength = testLength;
      j++;
    }

    if (chunkSentences.length > 0) {
      chunks.push({
        text: chunkSentences.join(" "),
        index: chunks.length,
      });
    }

    if (j >= sentences.length) break;

    // 오버랩 계산
    let overlapLength = 0;
    let overlapCount = 0;
    for (let k = chunkSentences.length - 1; k >= 0; k--) {
      const sentLen = lengthOf(chunkSentences[k]);
      if (overlapLength + sentLen > overlapBudget) break;
      overlapLength += sentLen + 1;
      overlapCount++;
    }

    // 다음 시작점(무한 루프 방지)
    i = Math.max(j - overlapCount, i + 1);
  }

  return chunks;
}
