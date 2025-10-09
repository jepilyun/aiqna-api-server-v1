import {
  PINECONE_INDEX_NAME,
  TYouTubeTranscriptStandardFormat,
  TPineconeVectorMetadataForContent,
  TPineconeVector,
  ERequestCreateContentType,
} from "aiqna_common_v1";
import { chunkYouTubeVideoTranscript } from "./chunk-youtube-video-transcript.js";
import { IEmbeddingProvider } from "../../types/shared.js";
import { EmbeddingProviderFactory } from "../../embedding/embedding-provider-factory.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { YouTubeVideoMetadataAnalyzerByAI } from "./youtube-video-metadata-analyzer.js";
import { PROVIDER_CONFIGS } from "../../consts/const.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";

/**
 * Tier 1: 비디오 전체 요약을 Pinecone에 저장
 */
async function saveVideoSummaryToPinecone(
  videoMetadata: Partial<TPineconeVectorMetadataForContent>,
  provider: IEmbeddingProvider,
  modelName: string,
  indexName: string,
): Promise<void> {
  // 요약 정보가 없으면 스킵
  if (!videoMetadata.ai_summary || !videoMetadata.video_id) {
    console.log('⚠️ No AI summary available, skipping Tier 1');
    return;
  }

  console.log('📊 Tier 1: Saving video summary...');

  // 요약 텍스트 생성 (검색에 최적화)
  const summaryText = [
    `Title: ${videoMetadata.title || ''}`,
    `Summary: ${videoMetadata.ai_summary}`,
    videoMetadata.main_topics?.length 
      ? `Topics: ${videoMetadata.main_topics.join(', ')}` 
      : '',
    videoMetadata.key_points?.length 
      ? `Key Points: ${videoMetadata.key_points.join('; ')}` 
      : '',
    videoMetadata.keywords?.length 
      ? `Keywords: ${videoMetadata.keywords.join(', ')}` 
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  // 임베딩 생성
  const embedding = await provider.generateEmbedding(summaryText, modelName);

  // Summary Vector 생성
  const summaryId = `${videoMetadata.video_id}_summary`;
  
  const metadata: Record<string, string | number | boolean | string[]> = {
    video_id: videoMetadata.video_id,
    title: videoMetadata.title ?? "",
    type: 'summary', // 🔥 검색 필터용
    content_type: 'youtube_video_summary',
    ai_summary: videoMetadata.ai_summary,
    embedding_model: modelName,
    embedding_dimensions: provider.getDimensions(modelName),
    created_at: new Date().toISOString(),
  };

  // 배열 메타데이터 추가
  if (videoMetadata.main_topics?.length) {
    metadata.main_topics = videoMetadata.main_topics;
  }
  if (videoMetadata.key_points?.length) {
    metadata.key_points = videoMetadata.key_points;
  }
  if (videoMetadata.keywords?.length) {
    metadata.keywords = videoMetadata.keywords;
  }

  // 기존 비디오 메타데이터
  if (videoMetadata.channel_title) {
    metadata.channel_title = videoMetadata.channel_title;
  }
  if (videoMetadata.channel_id) {
    metadata.channel_id = videoMetadata.channel_id;
  }
  if (videoMetadata.published_date) {
    metadata.published_at = videoMetadata.published_date;
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

  const summaryVector: TPineconeVector = {
    id: summaryId,
    values: embedding,
    metadata,
  };

  await DBPinecone.upsertBatch(indexName, [summaryVector], 1);
  console.log('✓ Summary vector saved');
}

/**
 * Tier 2 & 3: 트랜스크립트 청크 저장 (기존 로직)
 */
async function saveTranscriptChunksToPinecone(
  transcripts: TYouTubeTranscriptStandardFormat[],
  videoMetadata: Partial<TPineconeVectorMetadataForContent>,
  provider: IEmbeddingProvider,
  modelName: string,
  indexName: string,
): Promise<void> {
  const metadataExtractor = new YouTubeVideoMetadataAnalyzerByAI();

  if (!videoMetadata.video_id) {
    throw new Error("Video ID Not Exists.");
  }

  for (const transcript of transcripts) {
    console.log(`📝 Tier 2/3: Saving ${transcript.language} transcript chunks...`);
    
    const contentKey = ContentKeyManager.createContentKey(
      ERequestCreateContentType.YoutubeVideo,
      videoMetadata.video_id,
      transcript.language,
    );
    const chunks = chunkYouTubeVideoTranscript(transcript.segments);

    if (chunks.length === 0) {
      console.warn(
        `⚠️  No chunks generated for ${transcript.language}, skipping...`,
      );
      continue;
    }

    const vectors: TPineconeVector[] = await Promise.all(
      chunks.map(async (chunk, idx) => {
        // 첫 3개만 상세 로그
        if (idx < 2) {
          console.log(
            `Chunk ${idx}: ${chunk.text.substring(0, 50)}... (${chunk.text.length} chars)`,
          );
        }

        // 1. 임베딩 생성
        const embedding = await provider.generateEmbedding(
          chunk.text,
          modelName,
        );

        // 2. 청크별 메타데이터 추출
        let chunkMetadata: TAnalyzedContentMetadata | null = null;
        try {
          if (!videoMetadata.video_id || !videoMetadata.title) {
            throw new Error("Video ID or Title Not Exists.");
          }
          chunkMetadata = await metadataExtractor.analyzeFromFullTranscript(
            videoMetadata.video_id,
            videoMetadata.title,
            chunk.text,
            transcript.language,
          );

          if (idx < 2) {
            console.log(`→ Metadata:`, {
              categories: chunkMetadata?.categories,
              locations: chunkMetadata?.locations,
              keywords: chunkMetadata?.keywords.slice(0, 3),
            });
          }
        } catch (metadataError) {
          console.warn(
            `    ⚠️  Metadata extraction failed for chunk ${idx}:`,
            metadataError,
          );
        }

        const chunkId = ContentKeyManager.createChunkId(contentKey, idx);

        const metadata: Record<string, string | number | boolean | string[]> = {
          video_id: videoMetadata.video_id ?? "",
          title: videoMetadata.title ?? "",
          type: 'transcript', // 🔥 검색 필터용
          content_type: 'youtube_video_transcript',
          language: transcript.language,
          chunk_index: idx,
          chunk_id: chunkId,
          start_time: chunk.startTime,
          end_time: chunk.endTime,
          text: chunk.text,
          text_length: chunk.text.length,
          embedding_model: modelName,
          embedding_dimensions: provider.getDimensions(modelName),
          created_at: new Date().toISOString(),
        };

        // 기존 비디오 메타데이터
        if (videoMetadata.channel_title)
          metadata.channel_title = videoMetadata.channel_title;
        if (videoMetadata.channel_id)
          metadata.channel_id = videoMetadata.channel_id;
        if (videoMetadata.published_date)
          metadata.published_at = videoMetadata.published_date;
        if (videoMetadata.thumbnail_url)
          metadata.thumbnail_url = videoMetadata.thumbnail_url;
        if (videoMetadata.duration) metadata.duration = videoMetadata.duration;
        if (videoMetadata.view_count)
          metadata.view_count = videoMetadata.view_count;
        if (videoMetadata.like_count)
          metadata.like_count = videoMetadata.like_count;

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

    console.log(
      `  ✓ Completed ${chunks.length} chunks for ${transcript.language}`,
    );
  }
}

/**
 * 🔥 수정된 메인 함수: 3-Tier 통합 저장
 * Tier 1: Summary (비디오 전체 요약)
 * Tier 2 & 3: Transcript Chunks (기존 방식)
 */
async function saveYouTubeTranscriptsToPinecone(
  transcripts: TYouTubeTranscriptStandardFormat[],
  videoMetadata: Partial<TPineconeVectorMetadataForContent>,
  provider: IEmbeddingProvider,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const embeddingModel = modelName || provider.getDefaultModel();

  // Tier 1: 비디오 요약 저장
  await saveVideoSummaryToPinecone(
    videoMetadata,
    provider,
    embeddingModel,
    indexName,
  );

  // Tier 2 & 3: 트랜스크립트 청크 저장
  await saveTranscriptChunksToPinecone(
    transcripts,
    videoMetadata,
    provider,
    embeddingModel,
    indexName,
  );
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