import { IEmbeddingProvider } from "../types";

/**
 * Jina AI Embedding Provider
 */
export class JinaEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.JINA_API_KEY || "";
  }

  getDefaultModel(): string {
    return "jina-embeddings-v2-base-en";
  }

  getDimensions(model?: string): number {
    console.log("model =====>", model);
    return 768;
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const modelName = model || this.getDefaultModel();

    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        input: [text],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Jina API Error: ${error.detail || "Unknown error"}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
