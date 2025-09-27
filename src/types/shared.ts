/**
 * Embedding Provider 인터페이스
 */export interface IEmbeddingProvider {
  generateEmbedding(text: string, model?: string): Promise<number[]>;
  getDefaultModel(): string;
  getDimensions(model?: string): number;
}