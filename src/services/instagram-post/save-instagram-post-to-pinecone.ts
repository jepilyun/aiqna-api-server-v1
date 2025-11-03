import {
  PINECONE_INDEX_NAME,
  TPineconeMetadata,
  IPineconeVectorMetadataForInstagramPost,
  TPineconeVector,
  TSqlInstagramPostDetail,
} from "aiqna_common_v1";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { MetadataGeneratorInstagramPost } from "../metadata-generator/metadata-generator-instagram-post.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import { ERequestCreateContentType } from "../../consts/const.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
export async function saveInstagramPostToPinecone(
  instagramPost: TSqlInstagramPostDetail,
  instagramPostMetadata: Partial<IPineconeVectorMetadataForInstagramPost>,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const provider = new OpenAIEmbeddingProvider();
  const embeddingModel = modelName || provider.getDefaultModel();
  const metadataExtractor = new MetadataGeneratorInstagramPost();

  let content = "";

  if (instagramPost.description) {
    content = instagramPost.description.substring(0, 8000);
  } else if (instagramPost.og_description) {
    content = instagramPost.og_description.substring(0, 8000);
  } else if (instagramPost.og_title) {
    content = instagramPost.og_title.substring(0, 8000);
  }

  // 1. 임베딩 생성
  const embedding = await provider.generateEmbedding(content, embeddingModel);

  // 2. 메타데이터 추출
  let extractedMetadata: TAnalyzedContentMetadata | null = null;

  extractedMetadata =
    await metadataExtractor.generateMetadataFromInstagramPost(instagramPost);

  const contentKey = ContentKeyManager.createContentKey(
    ERequestCreateContentType.Instagram,
    instagramPost.instagram_post_url,
  );

  const metadata: TPineconeMetadata = {
    id: contentKey,
    text: content,
    text_length: content.length,
    embedding_model: embeddingModel,
    embedding_dimensions: provider.getDimensions(embeddingModel),
    created_at: new Date().toISOString(),
    ...instagramPostMetadata,
  };


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
    if (extractedMetadata.info_travel_tips.length > 0) {
      metadata.info_travel_tips = extractedMetadata.info_travel_tips;
    }
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

  // ✅ TPineconeVector 객체 생성
  const vector: TPineconeVector = {
    id: contentKey,
    values: embedding, // ⭐ 임베딩 벡터를 values에 전달
    metadata: metadata,
  };

  // DBPinecone을 사용한 업로드
  await DBPinecone.upsertOne(indexName, vector);

  console.log(`✓ Completed for ${instagramPost.instagram_post_url}`);
}
