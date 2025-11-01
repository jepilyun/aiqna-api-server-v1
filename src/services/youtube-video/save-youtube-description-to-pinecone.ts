import {
  IPineconeVectorMetadataForVideo,
  TPineconeVector,
  TSqlYoutubeVideoDetail,
} from "aiqna_common_v1";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { MetadataGeneratorYouTubeVideo } from "../metadata-generator/metadata-generator-youtube-video.js";
import { PROVIDER_CONFIGS } from "../../consts/const.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import { ERequestCreateContentType } from "../../consts/const.js";
import { chunkYouTubeDescription } from "../chunk/chunk-youtube-description.js";
import {
  safeForEmbedding,
  toSnippet,
} from "../../utils/chunk-embedding-utils.js";

/**
 * Save YouTube Description to Pinecone
 * @param videoData
 * @param vectorMetadata
 */
export async function saveYouTubeDescriptionToPinecone(
  videoData: TSqlYoutubeVideoDetail,
  vectorMetadata: Partial<IPineconeVectorMetadataForVideo>,
) {
  try {
    const provider = new OpenAIEmbeddingProvider();

    if (!vectorMetadata) {
      throw new Error("Metadata Needed");
    }

    const metadataExtractor = new MetadataGeneratorYouTubeVideo();

    const contentKey = ContentKeyManager.createContentKey(
      ERequestCreateContentType.YoutubeVideo,
      videoData.video_id,
      "description",
    );

    const chunks = chunkYouTubeDescription(videoData.description ?? "");

    if (chunks.length === 0) {
      console.warn(`⚠️  No chunks generated for description, skipping...`);
      return;
    }

    const vectors: TPineconeVector[] = await Promise.all(
      chunks.map(async (chunk, idx) => {
        // 첫 2개만 상세 로그
        if (idx < 2) {
          console.log(
            `Chunk ${idx}: ${chunk.text.substring(0, 50)}... (${chunk.text.length} chars)`,
          );
        }

        // 1. 임베딩 생성
        const embedding = await provider.generateEmbedding(
          safeForEmbedding(chunk.text),
          PROVIDER_CONFIGS.openai.model,
        );

        // 2. 청크별 메타데이터 추출
        let chunkMetadata: TAnalyzedContentMetadata | null = null;

        try {
          chunkMetadata =
            await metadataExtractor.generateMetadataFromFullTranscript(
              videoData.video_id,
              vectorMetadata.title ?? "",
              chunk.text,
              "description",
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
          video_id: videoData.video_id,
          title: vectorMetadata.title ?? "",
          type: "transcript", // 🔥 검색 필터용
          content_type: "youtube_video_description",
          language: "description",
          chunk_index: idx,
          chunk_id: chunkId,
          text: toSnippet(chunk.text),
          text_length: chunk.text.length,
          embedding_model: PROVIDER_CONFIGS.openai.model,
          embedding_dimensions: provider.getDimensions(
            PROVIDER_CONFIGS.openai.model,
          ),
          created_at: new Date().toISOString(),
        };

        // 기존 비디오 메타데이터
        if (vectorMetadata.channel_title)
          metadata.channel_title = vectorMetadata.channel_title;
        if (vectorMetadata.channel_id)
          metadata.channel_id = vectorMetadata.channel_id;
        if (vectorMetadata.published_date)
          metadata.published_at = vectorMetadata.published_date;
        if (vectorMetadata.thumbnail_url)
          metadata.thumbnail_url = vectorMetadata.thumbnail_url;
        if (vectorMetadata.duration)
          metadata.duration = vectorMetadata.duration;
        if (vectorMetadata.view_count)
          metadata.view_count = vectorMetadata.view_count;
        if (vectorMetadata.like_count)
          metadata.like_count = vectorMetadata.like_count;

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
    await DBPinecone.upsertBatch(PROVIDER_CONFIGS.openai.index, vectors, 100);

    console.log(`  ✓ Completed ${chunks.length} chunks for description`);

    console.log(`[${PROVIDER_CONFIGS.openai.type}] ✓ Success`);
    return { provider: PROVIDER_CONFIGS.openai.type, status: "success" };
  } catch (error) {
    console.error(
      `[${PROVIDER_CONFIGS.openai.type}] ✗ Failed:`,
      (error as Error).message,
    );
    return { provider: PROVIDER_CONFIGS.openai.type, status: "error", error };
  }
}
