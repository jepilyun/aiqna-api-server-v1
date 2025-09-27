import { IEmbeddingProvider } from "../../types/shared.js";


/**
 * Voyage AI Embedding Provider
 */
export class VoyageEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VOYAGE_API_KEY || '';
  }
  
  getDefaultModel(): string {
    return 'voyage-large-2';
  }
  
  getDimensions(model?: string): number {
    const modelName = model || this.getDefaultModel();
    const dimensionMap: Record<string, number> = {
      'voyage-large-2': 1536,
      'voyage-code-2': 1536,
      'voyage-2': 1024
    };
    return dimensionMap[modelName] || 1536;
  }
  
  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const modelName = model || this.getDefaultModel();
    
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        input: text
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Voyage API Error: ${error.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }
}

