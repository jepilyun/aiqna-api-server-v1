// OpenAI 임베딩 생성 (예시 - 실제로는 원하는 AI 모델 사용)
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // 여기서는 예시로 OpenAI를 사용하지만, 다른 AI 모델로 변경 가능
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: "text-embedding-ada-002",
      }),
    });

    const data = await response.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}
