import {
  IPineconeVectorMetadataForVideo,
  TPineconeVector,
} from "aiqna_common_v1";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { MetadataGeneratorYouTubeVideo } from "../metadata-generator/metadata-generator-youtube-video.js";
import { METADATA_GENERATOR_MODEL, METADATA_GENERATOR_MODEL_NAME, METADATA_GENERATOR_PROVIDER, PROVIDER_CONFIGS } from "../../consts/const.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import { ERequestCreateContentType } from "../../consts/const.js";
import { chunkYouTubeDescription } from "../chunk/chunk-youtube-description.js";
import {
  safeForEmbedding,
  toSnippet,
} from "../../utils/chunk-embedding-utils.js";
import { youtube_v3 } from "googleapis";
import { saveDataToLocal } from "../../utils/save-file.js";

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
    if (!vectorMetadata) {
      throw new Error("Metadata Needed");
    }

    const embeddingProvider = new OpenAIEmbeddingProvider();

    const metadataExtractor = new MetadataGeneratorYouTubeVideo({
      provider: METADATA_GENERATOR_PROVIDER,
      model: METADATA_GENERATOR_MODEL,
      modelName: METADATA_GENERATOR_MODEL_NAME,
    });

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

    const rawMetadata = await metadataExtractor.generateMetadataFromText(videoData.id ?? "", vectorMetadata.title ?? "", videoData.snippet?.description ?? "", "description");

    if (!rawMetadata) {
      console.warn(`⚠️  No metadata generated for description, skipping...`);
      return;
    }

    // DEV Save File
    // ytb_video_XXXXXXXX_s02_desc_meta_[provider]_[model]_raw.txt
    saveDataToLocal(rawMetadata, `ytb_video_${videoData.id ?? ""}_s02_desc_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}`, "raw", "txt", "../data/metaYouTube");

    const parsedMetadata = await metadataExtractor.parseResponse(rawMetadata);

    if (!parsedMetadata) {
      console.warn(`⚠️  No parsed metadata generated for description, skipping...`);
      return;
    }

    // DEV Save File
    // ytb_video_XXXXXXXX_s02_desc_meta_[provider]_[model]_parsed.json
    saveDataToLocal(parsedMetadata, `ytb_video_${videoData.id ?? ""}_s02_desc_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}`, "parsed", "json", "../data/metaYouTube");

    const vectors: TPineconeVector[] = (await Promise.all(
      chunks.map(async (chunk, idx) => {
        // 첫 2개만 상세 로그
        if (idx < 2) {
          console.log(
            `Chunk ${idx}: ${chunk.text.substring(0, 50)}... (${chunk.text.length} chars)`,
          );
        }
    
        // 1. 임베딩 생성
        const embedding = await embeddingProvider.generateEmbedding(
          safeForEmbedding(chunk.text),
          PROVIDER_CONFIGS.openai.model,
        );
    
        // 2. 청크별 메타데이터 추출
        let chunkParsedMetadata: TAnalyzedContentMetadata | null = null;
    
        try {
          const chunkRawMetadata =
            await metadataExtractor.generateMetadataFromText(
              videoData.id ?? "",
              vectorMetadata.title ?? "",
              chunk.text,
              "description",
            );
    
          if (!chunkRawMetadata) {
            console.warn(`⚠️  No metadata generated for chunk ${idx}, continuing without metadata...`);
          } else {
            chunkParsedMetadata = await metadataExtractor.parseResponse(chunkRawMetadata);
    
            if (idx < 2) {
              console.log(`   Metadata:`, {
                info_country: chunkParsedMetadata?.info_country,
                info_city: chunkParsedMetadata?.info_city,
                info_district: chunkParsedMetadata?.info_district,
                info_neighborhood: chunkParsedMetadata?.info_neighborhood,
                info_landmark: chunkParsedMetadata?.info_landmark,
                info_category: chunkParsedMetadata?.info_category,
                info_name: chunkParsedMetadata?.info_name,
                info_special_tag: chunkParsedMetadata?.info_special_tag,
                info_influencer: chunkParsedMetadata?.info_influencer,
                info_season: chunkParsedMetadata?.info_season,
                info_time_of_day: chunkParsedMetadata?.info_time_of_day,
                info_activity_type: chunkParsedMetadata?.info_activity_type,
                info_target_audience: chunkParsedMetadata?.info_target_audience,
                info_reservation_required: chunkParsedMetadata?.info_reservation_required,
                info_travel_tips: chunkParsedMetadata?.info_travel_tips,
                language: chunkParsedMetadata?.language,
                sentimentScore: chunkParsedMetadata?.sentimentScore,
                mainTopic: chunkParsedMetadata?.mainTopic,
                confidence_score: chunkParsedMetadata?.confidence_score,
              });
            }
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
          embedding_dimensions: embeddingProvider.getDimensions(
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
        if (chunkParsedMetadata) {
          if (chunkParsedMetadata.info_country.length > 0) {
            metadata.info_country = chunkParsedMetadata.info_country;
          }
          if (chunkParsedMetadata.info_city.length > 0) {
            metadata.info_city = chunkParsedMetadata.info_city;
          }
          if (chunkParsedMetadata.info_district.length > 0) {
            metadata.info_district = chunkParsedMetadata.info_district;
          }
          if (chunkParsedMetadata.info_neighborhood.length > 0) {
            metadata.info_neighborhood = chunkParsedMetadata.info_neighborhood;
          }
          if (chunkParsedMetadata.info_category.length > 0) {
            metadata.info_category = chunkParsedMetadata.info_category;
          }
          if (chunkParsedMetadata.info_name.length > 0) {
            metadata.info_name = chunkParsedMetadata.info_name;
          }
          if (chunkParsedMetadata.info_special_tag.length > 0) {
            metadata.info_special_tag = chunkParsedMetadata.info_special_tag;
          }
          if (chunkParsedMetadata.info_influencer.length > 0) {
            metadata.info_influencer = chunkParsedMetadata.info_influencer;
          }
          if (chunkParsedMetadata.info_season.length > 0) {
            metadata.info_season = chunkParsedMetadata.info_season;
          }
          if (chunkParsedMetadata.info_time_of_day.length > 0) {
            metadata.info_time_of_day = chunkParsedMetadata.info_time_of_day;
          }
          if (chunkParsedMetadata.info_activity_type.length > 0) {
            metadata.info_activity_type = chunkParsedMetadata.info_activity_type;
          }
          if (chunkParsedMetadata.info_target_audience.length > 0) {
            metadata.info_target_audience = chunkParsedMetadata.info_target_audience;
          }
          if (chunkParsedMetadata.info_reservation_required) {
            metadata.info_reservation_required = chunkParsedMetadata.info_reservation_required;
          }
          // if (extractedMetadata.info_travel_tips.length > 0) {
          //   metadata.info_travel_tips = extractedMetadata.info_travel_tips;
          // }
          if (chunkParsedMetadata.language) {
            metadata.language = chunkParsedMetadata.language;
          }
          if (chunkParsedMetadata.sentimentScore) {
            metadata.sentimentScore = chunkParsedMetadata.sentimentScore;
          }
          if (chunkParsedMetadata.mainTopic) {
            metadata.mainTopic = chunkParsedMetadata.mainTopic;
          }
          if (chunkParsedMetadata.confidence_score) {
            metadata.confidence_score = chunkParsedMetadata.confidence_score;
          }
        }
    
        return {
          id: chunkId,
          values: embedding,
          metadata,
        } as TPineconeVector;
      }),
    ));

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
