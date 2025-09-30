import {
  EMBEDDING_MODEL,
  PINECONE_INDEX_NAME,
  TPineconeFullYouTubeTranscript,
  TPineconeYouTubeVideoMetadata,
} from "aiqna_common_v1";
import { chunkTranscript } from "../../utils/chunk-transcript.js";
import pineconeClient from "../../config/pinecone-client.js";
import { IEmbeddingProvider } from "../../types/shared.js";
import { EmbeddingProviderFactory } from "../../utils/utils-embedding/embedding-provider-factory.js";
import { TExtractedVideoMetadata } from "../../types/shared.js";
import { VideoMetadataExtractionService } from "../../utils/utils-ai/extract-metadata.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
export async function saveToPineconeWithProvider(
  transcripts: TPineconeFullYouTubeTranscript[],
  videoMetadata: TPineconeYouTubeVideoMetadata,
  provider: IEmbeddingProvider,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const index = pineconeClient.index(indexName);
  const embeddingModel = modelName || provider.getDefaultModel();
  const metadataExtractor = new VideoMetadataExtractionService();

  for (const transcript of transcripts) {
    const chunks = chunkTranscript(transcript.segments);

    if (chunks.length === 0) {
      console.warn(`⚠️  No chunks generated for ${transcript.language}, skipping...`);
      continue;
    }

    const vectors = await Promise.all(
      chunks.map(async (chunk, idx) => {
        // 첫 5개만 상세 로그
        if (idx < 5) {
          console.log(`  Chunk ${idx}: ${chunk.text.substring(0, 50)}... (${chunk.text.length} chars)`);
        }

        // 1. 임베딩 생성
        const embedding = await provider.generateEmbedding(chunk.text, embeddingModel);
        
        // 2. 청크별 메타데이터 추출
        let chunkMetadata: TExtractedVideoMetadata | null = null;
        try {
          chunkMetadata = await metadataExtractor.extractMetadata(
            videoMetadata.video_id,
            videoMetadata.title,
            chunk.text, // 전체가 아닌 이 청크의 텍스트만
            transcript.language
          );

          if (idx < 5) {
            console.log(`    → Metadata:`, {
              categories: chunkMetadata?.categories,
              locations: chunkMetadata?.locations,
              keywords: chunkMetadata?.keywords.slice(0, 3)
            });
          }
        } catch (metadataError) {
          console.warn(`    ⚠️  Metadata extraction failed for chunk ${idx}:`, metadataError);
        }

        const chunkId = `${videoMetadata.video_id}_${transcript.language}_${idx}`;

        const metadata: Record<string, string | number | boolean | string[]> = {
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
          created_at: new Date().toISOString(),
        };

        // 기존 비디오 메타데이터
        if (videoMetadata.channel_title) metadata.channel_title = videoMetadata.channel_title;
        if (videoMetadata.channel_id) metadata.channel_id = videoMetadata.channel_id;
        if (videoMetadata.published_at) metadata.published_at = videoMetadata.published_at;
        if (videoMetadata.thumbnail_url) metadata.thumbnail_url = videoMetadata.thumbnail_url;
        if (videoMetadata.duration) metadata.duration = videoMetadata.duration;
        if (videoMetadata.view_count) metadata.view_count = videoMetadata.view_count;
        if (videoMetadata.like_count) metadata.like_count = videoMetadata.like_count;

        // 청크별 추출된 메타데이터 추가
        if (chunkMetadata) {
          if (chunkMetadata.categories.length > 0) {
            metadata.categories = chunkMetadata.categories;
          }
          if (chunkMetadata.keywords.length > 0) {
            metadata.keywords = chunkMetadata.keywords;
          }
          if (chunkMetadata.locations.length > 0) {
            metadata.locations = chunkMetadata.locations;
          }
          if (chunkMetadata.names.length > 0) {
            metadata.names = chunkMetadata.names;
          }
          metadata.confidence_score = chunkMetadata.confidence_score;
        }

        return {
          id: chunkId,
          values: embedding,
          metadata,
        };
      }),
    );

    // Pinecone 업로드
    const batchSize = 100;
    const totalBatches = Math.ceil(vectors.length / batchSize);

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`  Batch ${batchNum}/${totalBatches}: uploading ${batch.length} vectors...`);
      await index.upsert(batch);
    }

    console.log(`  ✓ Completed ${chunks.length} chunks for ${transcript.language}`);
  }
}

// 설정 파일
const PROVIDER_CONFIGS = [
  {
    type: "openai",
    model: EMBEDDING_MODEL.OPENAI.SMALL,
    index: PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.OPENAI_SMALL,
  },
  // {
  //   type: 'cohere',
  //   model: EMBEDDING_MODEL.COHERE.MULTI,
  //   index: PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.COHERE_MULTI
  // },
  // {
  //   type: 'voyage',
  //   model: EMBEDDING_MODEL.VOYAGE.LARGE_2,
  //   index: PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.VOYAGE_LARGE_2
  // },
  // {
  //   type: 'huggingface',
  //   model: EMBEDDING_MODEL.HUGGINGFACE.KO_SROBERTA_MULTITASK,
  //   index: PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.HF_KOREAN
  // }
] as const;


/**
 * Process with Different Providers
 * @param transcripts 
 * @param videoMetadata 
 */
export async function processWithDifferentProviders(
  transcripts: TPineconeFullYouTubeTranscript[],
  videoMetadata: TPineconeYouTubeVideoMetadata,
) {
  transcripts.forEach((t, idx) => {
    console.log(`Transcript ${idx + 1}:`, {
      language: t.language,
      segments_count: t.segments?.length || 0,
      first_segment_sample: t.segments?.[0]
        ? {
            text: t.segments[0].text?.substring(0, 50) + "...",
            startTime: t.segments[0].start,
            duration: t.segments[0].duration,
          }
        : "NO SEGMENTS",
    });
  });
  console.log("========================\n");
  console.log(
    `Starting parallel processing for ${PROVIDER_CONFIGS.length} providers...`,
  );

  const startTime = Date.now();

  const results = await Promise.allSettled(
    PROVIDER_CONFIGS.map(async (config) => {
      try {
        console.log(`[${config.type}] Starting...`);

        const provider = EmbeddingProviderFactory.createProvider(config.type);
        await saveToPineconeWithProvider(
          transcripts,
          videoMetadata,
          provider,
          config.model,
          config.index,
        );

        console.log(`[${config.type}] ✓ Success`);
        return { provider: config.type, status: "success" };
      } catch (error) {
        console.error(`[${config.type}] ✗ Failed:`, (error as Error).message);
        return { provider: config.type, status: "error", error };
      }
    }),
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=== Processing Summary ===");
  console.log(`All providers completed in ${elapsed}s`);

  results.forEach((result, idx) => {
    const config = PROVIDER_CONFIGS[idx];
    if (result.status === "fulfilled") {
      console.log(`✓ ${config.type}: Success`);
    } else {
      console.log(`✗ ${config.type}: Failed -`, result.reason);
    }
  });

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`\nResults: ${succeeded} succeeded, ${failed} failed`);
  console.log("==========================\n");

  if (succeeded === 0) {
    throw new Error("All embedding providers failed");
  }
}