import {
  IPineconeVectorMetadataForVideo,
  TPineconeVector,
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
import { youtube_v3 } from "googleapis";
import { saveJsonToLocal } from "../../utils/helper-json.js";

/**
 * Save YouTube Description to Pinecone
 * @param videoData
 * @param vectorMetadata
 */
export async function saveYouTubeDescriptionToPinecone(
  videoData: youtube_v3.Schema$Video,
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
      videoData.id ?? "",
      "description",
    );

    const chunks = chunkYouTubeDescription(videoData.snippet?.description ?? "");

    if (chunks.length === 0) {
      console.warn(`⚠️  No chunks generated for description, skipping...`);
      return;
    }

    const metadataFromFullDescription = await metadataExtractor.generateMetadataFromText(videoData.id ?? "", vectorMetadata.title ?? "", videoData.snippet?.description ?? "", "description");
    saveJsonToLocal(metadataFromFullDescription, `metadata_from_${videoData.id}.json`, "_full_description", "../data/metadataFromFullDescription");

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
        let extractedMetadata: TAnalyzedContentMetadata | null = null;

        try {
          extractedMetadata =
            await metadataExtractor.generateMetadataFromText(
              videoData.id ?? "",
              vectorMetadata.title ?? "",
              chunk.text,
              "description",
            );

          if (idx < 2) {
            console.log(`   Metadata:`, {
              info_country: extractedMetadata?.info_country,
              info_city: extractedMetadata?.info_city,
              info_district: extractedMetadata?.info_district,
              info_neighborhood: extractedMetadata?.info_neighborhood,
              info_landmark: extractedMetadata?.info_landmark,
              info_category: extractedMetadata?.info_category,
              info_name: extractedMetadata?.info_name,
              info_special_tag: extractedMetadata?.info_special_tag,
              info_influencer: extractedMetadata?.info_influencer,
              info_season: extractedMetadata?.info_season,
              info_time_of_day: extractedMetadata?.info_time_of_day,
              info_activity_type: extractedMetadata?.info_activity_type,
              info_target_audience: extractedMetadata?.info_target_audience,
              info_reservation_required: extractedMetadata?.info_reservation_required,
              info_travel_tips: extractedMetadata?.info_travel_tips,
              language: extractedMetadata?.language,
              sentimentScore: extractedMetadata?.sentimentScore,
              mainTopic: extractedMetadata?.mainTopic,
              confidence_score: extractedMetadata?.confidence_score,
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
          video_id: videoData.id ?? "",
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
        if (extractedMetadata) {
          if (extractedMetadata.info_country.length > 0) {
            metadata.info_country = extractedMetadata.info_country;
          }
          if (extractedMetadata.info_city.length > 0) {
            metadata.info_city = extractedMetadata.info_city;
          }
          if (extractedMetadata.info_district.length > 0) {
            metadata.info_district = extractedMetadata.info_district;
          }
          if (extractedMetadata.info_neighborhood.length > 0) {
            metadata.info_neighborhood = extractedMetadata.info_neighborhood;
          }
          if (extractedMetadata.info_category.length > 0) {
            metadata.info_category = extractedMetadata.info_category;
          }
          if (extractedMetadata.info_name.length > 0) {
            metadata.info_name = extractedMetadata.info_name;
          }
          if (extractedMetadata.info_special_tag.length > 0) {
            metadata.info_special_tag = extractedMetadata.info_special_tag;
          }
          if (extractedMetadata.info_influencer.length > 0) {
            metadata.info_influencer = extractedMetadata.info_influencer;
          }
          if (extractedMetadata.info_season.length > 0) {
            metadata.info_season = extractedMetadata.info_season;
          }
          if (extractedMetadata.info_time_of_day.length > 0) {
            metadata.info_time_of_day = extractedMetadata.info_time_of_day;
          }
          if (extractedMetadata.info_activity_type.length > 0) {
            metadata.info_activity_type = extractedMetadata.info_activity_type;
          }
          if (extractedMetadata.info_target_audience.length > 0) {
            metadata.info_target_audience = extractedMetadata.info_target_audience;
          }
          if (extractedMetadata.info_reservation_required) {
            metadata.info_reservation_required = extractedMetadata.info_reservation_required;
          }
          // if (extractedMetadata.info_travel_tips.length > 0) {
          //   metadata.info_travel_tips = extractedMetadata.info_travel_tips;
          // }
          if (extractedMetadata.language) {
            metadata.language = extractedMetadata.language;
          }
          if (extractedMetadata.sentimentScore) {
            metadata.sentimentScore = extractedMetadata.sentimentScore;
          }
          if (extractedMetadata.mainTopic) {
            metadata.mainTopic = extractedMetadata.mainTopic;
          }
          if (extractedMetadata.confidence_score) {
            metadata.confidence_score = extractedMetadata.confidence_score;
          }
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
