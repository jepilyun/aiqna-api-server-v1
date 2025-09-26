/**
 * OpenAI API를 사용하여 텍스트 배열의 임베딩 벡터를 생성합니다.
 * 
 * @param texts - 임베딩으로 변환할 텍스트 배열
 * @returns 각 텍스트에 대한 임베딩 벡터 배열 (각 벡터는 숫자 배열)
 * @throws 
 * - API 키가 유효하지 않은 경우
 * - 네트워크 오류 발생 시
 * - OpenAI API 할당량 초과 시
 * - API 응답 형식이 예상과 다른 경우
 * 
 * @remarks
 * - 환경변수 OPENAI_API_KEY에 유효한 OpenAI API 키가 필요합니다
 * - 기본 모델: text-embedding-ada-002 (1536 차원 벡터 생성)
 * - 다른 임베딩 모델(text-embedding-3-small, text-embedding-3-large 등)로 변경 가능
 * - 대량의 텍스트 처리 시 배치 크기와 rate limit 고려 필요
 * - 생성된 임베딩은 벡터 DB에 저장하여 의미론적 검색에 활용 가능
 * 
 * @example
 * ```typescript
 * // 단일 텍스트 임베딩 생성
 * const texts = ["안녕하세요"];
 * const embeddings = await generateEmbeddings(texts);
 * // [[0.123, -0.456, 0.789, ...]] (1536개 숫자)
 * 
 * // 여러 텍스트 배치 처리
 * const multipleTexts = [
 *   "TypeScript는 JavaScript의 슈퍼셋입니다",
 *   "React는 UI 라이브러리입니다",
 *   "Node.js는 서버사이드 JavaScript 런타임입니다"
 * ];
 * const multipleEmbeddings = await generateEmbeddings(multipleTexts);
 * // [
 * //   [0.123, -0.456, ...],  // 첫 번째 텍스트 벡터
 * //   [0.234, -0.567, ...],  // 두 번째 텍스트 벡터
 * //   [0.345, -0.678, ...]   // 세 번째 텍스트 벡터
 * // ]
 * 
 * // 트랜스크립트 청크 임베딩 생성
 * const chunks = [
 *   "오늘은 AI에 대해 이야기하겠습니다",
 *   "AI는 우리 삶을 변화시키고 있습니다"
 * ];
 * const chunkEmbeddings = await generateEmbeddings(chunks);
 * // 벡터 DB에 저장하여 의미론적 검색 구현
 * ```
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: "text-embedding-ada-002", // 또는 text-embedding-3-small, text-embedding-3-large
      }),
    });

    const data = await response.json();
    
    // OpenAI API 응답에서 임베딩 벡터 추출
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}

