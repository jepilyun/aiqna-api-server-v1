import { IEmbeddingProvider } from "../types/shared.js";
import { CohereEmbeddingProvider } from "./cohere-embedding.js";
import { HuggingFaceEmbeddingProvider } from "./huggingface-embedding.js";
import { JinaEmbeddingProvider } from "./jina-embedding.js";
import { OpenAIEmbeddingProvider } from "./openai-embedding.js";
import { VoyageEmbeddingProvider } from "./voyage-embedding.js";

/**
 * Embedding Provider Factory
 */
export type EmbeddingProviderType = 'openai' | 'cohere' | 'voyage' | 'huggingface' | 'jina';

export class EmbeddingProviderFactory {
  static createProvider(
    type: EmbeddingProviderType, 
    config?: { apiKey?: string; apiUrl?: string }
  ): IEmbeddingProvider {
    switch (type) {
      case 'openai':
        return new OpenAIEmbeddingProvider(config?.apiKey);
      case 'cohere':
        return new CohereEmbeddingProvider(config?.apiKey);
      case 'voyage':
        return new VoyageEmbeddingProvider(config?.apiKey);
      case 'huggingface':
        return new HuggingFaceEmbeddingProvider(config?.apiKey, config?.apiUrl);
      case 'jina':
        return new JinaEmbeddingProvider(config?.apiKey);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }
}