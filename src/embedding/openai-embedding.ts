import { IEmbeddingProvider } from "../types";

/**
 * OpenAI Embedding Provider
 */
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
  }

  getDefaultModel(): string {
    return "text-embedding-3-small";
  }

  getDimensions(model?: string): number {
    const modelName = model || this.getDefaultModel();
    const dimensionMap: Record<string, number> = {
      "text-embedding-3-small": 512,
      "text-embedding-3-large": 3072,
      "text-embedding-ada-002": 1536,
    };
    return dimensionMap[modelName] || 1536;
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const modelName = model || this.getDefaultModel();
    const dimensions = this.getDimensions(modelName); // ✅ 차원 가져오기

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        input: text,
        dimensions: dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `OpenAI API Error: ${error.error?.message || "Unknown error"}`,
      );
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
