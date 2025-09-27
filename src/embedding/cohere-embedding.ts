import { IEmbeddingProvider } from "../types/shared.js";

/**
 * Cohere Embedding Provider
 */
export class CohereEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COHERE_API_KEY || '';
  }
  
  getDefaultModel(): string {
    return 'embed-multilingual-v3.0';
  }
  
  getDimensions(model?: string): number {
    console.log("model =====>", model);
    return 1024; // Cohere v3 models are 1024 dimensions
  }
  
  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const modelName = model || this.getDefaultModel();
    
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        texts: [text],
        input_type: 'search_document',
        embedding_types: ['float']
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Cohere API Error: ${error.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.embeddings.float[0];
  }
}
