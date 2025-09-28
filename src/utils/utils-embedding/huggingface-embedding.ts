import { IEmbeddingProvider } from "../../types/shared.js";

/**
 * Hugging Face Embedding Provider (Self-hosted or API)
 */
export class HuggingFaceEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey?: string, apiUrl?: string) {
    this.apiKey = apiKey || process.env.HUGGINGFACE_API_KEY || "";
    // 자체 호스팅 서버 URL 또는 HF Inference API
    this.apiUrl = apiUrl || "https://api-inference.huggingface.co/models";
  }

  getDefaultModel(): string {
    return "sentence-transformers/paraphrase-multilingual-mpnet-base-v2";
  }

  getDimensions(model?: string): number {
    const modelName = model || this.getDefaultModel();
    const dimensionMap: Record<string, number> = {
      "sentence-transformers/paraphrase-multilingual-mpnet-base-v2": 768,
      "jhgan/ko-sroberta-multitask": 768,
      "sentence-transformers/all-MiniLM-L6-v2": 384,
    };
    return dimensionMap[modelName] || 768;
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const modelName = model || this.getDefaultModel();

    const response = await fetch(`${this.apiUrl}/${modelName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        inputs: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HuggingFace API Error: ${error}`);
    }

    const embedding = await response.json();
    return Array.isArray(embedding)
      ? embedding
      : embedding.embeddings || embedding[0];
  }
}
