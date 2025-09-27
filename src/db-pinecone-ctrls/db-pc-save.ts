import { TPineconeChunkMetadata, TPineconeTranscriptData, TPineconeTranscriptVector, TPineconeVideoMetadata } from "aiqna_common_v1";
import { chunkTranscript } from "../utils/chunk-transcript.js";
import { pcdb } from "../config/pinecone";
import { IEmbeddingProvider } from "../types/shared.js";
import { EmbeddingProviderFactory } from "../utils/embedding/embedding-provider-factory.js";

/**
 * Pinecone에 벡터 저장
 */
export async function saveToPineconeOpenAIEmbedding(
  transcripts: TPineconeTranscriptData[],
  videoMetadata: TPineconeVideoMetadata,
  indexName: string = 'youtube-transcripts',
  embeddingModel: string = 'text-embedding-3-small'
): Promise<void> {
  const index = pcdb.index(indexName);
  
  // 모든 언어별 처리
  for (const transcript of transcripts) {
    const chunks = chunkTranscript(transcript.segments);
    
    const vectors: TPineconeTranscriptVector[] = chunks.map((chunk, idx) => {
      const chunkId = `${videoMetadata.video_id}_${transcript.language}_${idx}`;
      
      const metadata: TPineconeChunkMetadata = {
        video_id: videoMetadata.video_id,
        title: videoMetadata.title,
        channel_title: videoMetadata.channel_title,
        channel_id: videoMetadata.channel_id,
        published_at: videoMetadata.published_at,
        thumbnail_url: videoMetadata.thumbnail_url,
        duration: videoMetadata.duration,
        view_count: videoMetadata.view_count,
        like_count: videoMetadata.like_count,
        language: transcript.language,
        chunk_index: idx,
        chunk_id: chunkId,
        start_time: chunk.startTime,
        end_time: chunk.endTime,
        text: chunk.text,
        text_length: chunk.text.length,
        embedding_model: embeddingModel,
        created_at: new Date().toISOString()
      };
      
      return {
        id: chunkId,
        values: [], // 실제로는 embedding API로 생성된 벡터 필요
        metadata
      };
    });
    
    // Pinecone에 upsert
    await index.upsert(vectors);
    console.log(`✓ ${transcript.language}: ${vectors.length}개 chunk를 Pinecone에 저장 완료`);
  }
}



/**
 * Pinecone 저장 함수 (Provider 기반)
 */
export async function saveToPineconeWithProvider(
  transcripts: TPineconeTranscriptData[],
  videoMetadata: TPineconeVideoMetadata,
  provider: IEmbeddingProvider,
  modelName?: string,
  indexName: string = 'youtube-transcripts'
): Promise<void> {
  const index = pcdb.index(indexName);
  const embeddingModel = modelName || provider.getDefaultModel();
  
  for (const transcript of transcripts) {
    const chunks = chunkTranscript(transcript.segments);
    
    const vectors = await Promise.all(
      chunks.map(async (chunk, idx) => {
        // Provider를 통해 embedding 생성
        const embedding = await provider.generateEmbedding(chunk.text, embeddingModel);
        const chunkId = `${videoMetadata.video_id}_${transcript.language}_${idx}`;
        
        const metadata: Record<string, string | number | boolean> = { 
          video_id: videoMetadata.video_id,
          title: videoMetadata.title,
          language: transcript.language,
          chunk_index: idx,
          chunk_id: chunkId,
          start_time: chunk.startTime,
          end_time: chunk.endTime,
          text: chunk.text,
          text_length: chunk.text.length,
          embedding_model: embeddingModel,
          embedding_dimensions: provider.getDimensions(embeddingModel),
          created_at: new Date().toISOString()
        };

        if (videoMetadata.channel_title) {
          metadata.channel_title = videoMetadata.channel_title;
        }
        if (videoMetadata.channel_id) {
          metadata.channel_id = videoMetadata.channel_id;
        }
        if (videoMetadata.published_at) {
          metadata.published_at = videoMetadata.published_at;
        }
        if (videoMetadata.thumbnail_url) {
          metadata.thumbnail_url = videoMetadata.thumbnail_url;
        }
        if (videoMetadata.duration) {
          metadata.duration = videoMetadata.duration;
        }
        if (videoMetadata.view_count) {
          metadata.view_count = videoMetadata.view_count;
        }
        if (videoMetadata.like_count) {
          metadata.like_count = videoMetadata.like_count;
        }

        console.log("metadata =====>", metadata);
        
        return {
          id: chunkId,
          values: embedding,
          metadata
        };
      })
    );
    
    // 배치로 upsert
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
    }
    
    console.log(`✓ ${transcript.language}: ${vectors.length}개 chunk 저장 완료 (${embeddingModel})`);
  }
}

/**
 * 사용 예시 함수
 */
export async function processWithDifferentProviders(
  videoId: string,
  transcripts: TPineconeTranscriptData[],
  videoMetadata: TPineconeVideoMetadata
) {
  // 1. OpenAI로 실험
  const openaiProvider = EmbeddingProviderFactory.createProvider('openai');
  await saveToPineconeWithProvider(
    transcripts, 
    videoMetadata, 
    openaiProvider,
    'text-embedding-3-small',
    'youtube-openai-small'
  );
  
  // 2. Cohere로 실험
  const cohereProvider = EmbeddingProviderFactory.createProvider('cohere');
  await saveToPineconeWithProvider(
    transcripts, 
    videoMetadata, 
    cohereProvider,
    'embed-multilingual-v3.0',
    'youtube-cohere-multi'
  );
  
  // 3. Voyage로 실험
  const voyageProvider = EmbeddingProviderFactory.createProvider('voyage');
  await saveToPineconeWithProvider(
    transcripts, 
    videoMetadata, 
    voyageProvider,
    'voyage-large-2',
    'youtube-voyage-large'
  );
  
  // 4. HuggingFace 한국어 모델로 실험
  const hfProvider = EmbeddingProviderFactory.createProvider('huggingface');
  await saveToPineconeWithProvider(
    transcripts, 
    videoMetadata, 
    hfProvider,
    'jhgan/ko-sroberta-multitask',
    'youtube-hf-korean'
  );
}