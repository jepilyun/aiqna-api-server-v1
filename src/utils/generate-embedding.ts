/**
 * 텍스트 임베딩 생성 (OpenAI API 사용)
 * @param text - 임베딩할 텍스트
 * @param model - 사용할 OpenAI embedding 모델 (기본값: text-embedding-3-small)
 *                사용 가능한 모델:
 *                - text-embedding-3-small (1536 dimensions, 저렴)
 *                - text-embedding-3-large (3072 dimensions, 고성능)
 *                - text-embedding-ada-002 (1536 dimensions, 레거시)
 */
export async function generateEmbedding(
  text: string, 
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      input: text
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}