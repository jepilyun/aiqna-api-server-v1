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

/**
 * Text 콘텐츠를 청크로 분할 (개선 버전)
 * @param content
 * @param options
 * @returns
 */
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
    console.log("❌ Empty content, returning empty array");
    return [];
  }

  let text = content;
  if (cleanText) {
    text = text.replace(/\s+/g, " ").trim();
  }

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

  const chunks: TChunkTextContent[] = [];

  const sentences = text
    .split(/([.!?]+\s*)/)
    .reduce((acc: string[], curr, idx, arr) => {
      if (idx % 2 === 0 && curr.trim()) {
        const punctuation = arr[idx + 1] || "";
        acc.push(curr + punctuation);
      }
      return acc;
    }, [])
    .filter((s) => s.trim());

  if (sentences.length === 0) {
    console.log("⚠️ No sentences found, using entire text as one chunk");
    sentences.push(text);
  }

  let currentChunk = "";
  let currentLength = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLength = lengthOf(sentence);
    const candidateLength = currentLength + sentenceLength;

    if (currentChunk && candidateLength > maxBudget) {
      if (currentLength >= minBudget) {
        const trimmedChunk = currentChunk.trim();

        chunks.push({
          text: trimmedChunk,
          index: chunks.length,
        });

        const overlapStart = Math.max(0, trimmedChunk.length - overlapBudget);
        const overlapText = trimmedChunk.substring(overlapStart);

        currentChunk = overlapText + " " + sentence;
        currentLength = lengthOf(currentChunk);
      } else {
        currentChunk += " " + sentence;
        currentLength = candidateLength;
      }
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
      currentLength = candidateLength;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunks.length,
    });
  }

  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      text: text.trim(),
      index: 0,
    });
  }

  return chunks;
}
