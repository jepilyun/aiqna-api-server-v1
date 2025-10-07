import {
  PINECONE_INDEX_NAME,
  TYouTubeTranscriptStandardFormat,
  TPineconeVectorMetadataForContent,
  TPineconeVector,
} from "aiqna_common_v1";
import { chunkYouTubeVideoTranscript } from "./chunk-youtube-video-transcript.js";
import { IEmbeddingProvider } from "../../../types/shared.js";
import { EmbeddingProviderFactory } from "../../../embedding/embedding-provider-factory.js";
import { TAnalyzedContentMetadata } from "../../../types/shared.js";
import { YouTubeVideoMetadataAnalyzerByAI } from "./youtube-video-metadata-analyzer.js";
import { PROVIDER_CONFIGS } from "../../../consts/const.js";
import DBPinecone from "../../../ctrl-db/ctrl-db-vector/db-pinecone.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
async function saveYouTubeTranscriptsToPinecone(
  transcripts: TYouTubeTranscriptStandardFormat[],
  videoMetadata: Partial<TPineconeVectorMetadataForContent>,
  provider: IEmbeddingProvider,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const embeddingModel = modelName || provider.getDefaultModel();
  const metadataExtractor = new YouTubeVideoMetadataAnalyzerByAI();

  for (const transcript of transcripts) {
    const chunks = chunkYouTubeVideoTranscript(transcript.segments);

    if (chunks.length === 0) {
      console.warn(`⚠️  No chunks generated for ${transcript.language}, skipping...`);
      continue;
    }

    const vectors: TPineconeVector[] = await Promise.all(
      chunks.map(async (chunk, idx) => {
        // 첫 3개만 상세 로그
        if (idx < 2) {
          console.log(`Chunk ${idx}: ${chunk.text.substring(0, 50)}... (${chunk.text.length} chars)`);
        }

        // 1. 임베딩 생성
        const embedding = await provider.generateEmbedding(chunk.text, embeddingModel);

        // 2. 청크별 메타데이터 추출
        let chunkMetadata: TAnalyzedContentMetadata | null = null;
        try {
          if (!videoMetadata.video_id || !videoMetadata.title) {
            throw new Error("Video ID or Title Not Exists.")
          }
          chunkMetadata = await metadataExtractor.analyzeFromFullTranscript(
            videoMetadata.video_id,
            videoMetadata.title,
            chunk.text,
            transcript.language
          );

          if (idx < 2) {
            console.log(`→ Metadata:`, {
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
          video_id: videoMetadata.video_id ?? "",
          title: videoMetadata.title ?? "",
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
        if (videoMetadata.published_date) metadata.published_at = videoMetadata.published_date;
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

    // DBPinecone을 사용한 배치 업로드
    await DBPinecone.upsertBatch(indexName, vectors, 100);

    console.log(`  ✓ Completed ${chunks.length} chunks for ${transcript.language}`);
  }
}

/**
 * Process with Different Providers
 * @param transcripts 
 * @param vectorMetadata 
 */
export async function saveYouTubeTranscriptsToPineconeWithProviders(
  transcripts: TYouTubeTranscriptStandardFormat[],
  vectorMetadata: Partial<TPineconeVectorMetadataForContent>,
) {
  const results = await Promise.allSettled(
    PROVIDER_CONFIGS.map(async (config) => {
      try {
        const provider = EmbeddingProviderFactory.createProvider(config.type);

        if (!vectorMetadata) {
          throw new Error("Metadata Needed");
        }
        await saveYouTubeTranscriptsToPinecone(
          transcripts,
          vectorMetadata,
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

  results.forEach((result, idx) => {
    const config = PROVIDER_CONFIGS[idx];
    if (result.status === "fulfilled") {
      console.log(`✓ ${config.type}: Success`);
    } else {
      console.log(`✗ ${config.type}: Failed -`, result.reason);
    }
  });

  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  if (succeeded === 0) {
    throw new Error("All embedding providers failed");
  }
}