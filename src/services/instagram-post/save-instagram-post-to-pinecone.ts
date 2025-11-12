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
import { ERequestCreateContentType, METADATA_GENERATOR_MODEL, METADATA_GENERATOR_MODEL_NAME, METADATA_GENERATOR_PROVIDER } from "../../consts/const.js";
import DBSqlInstagramPost from "../../db-ctrl/db-ctrl-sql/db-sql-instagram-post.js";
import { saveDataToLocal } from "../../utils/save-file.js";
import { getInstagramPostId } from "../../utils/helper-instagram.js";

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
  const metadataExtractor = new MetadataGeneratorInstagramPost({
    provider: METADATA_GENERATOR_PROVIDER,              // "openai" 도 가능
    model: METADATA_GENERATOR_MODEL,
  });

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
  let parsedMetadata: TAnalyzedContentMetadata | null = null;

  const rawMetadata =
    await metadataExtractor.generateMetadataFromInstagramPost(instagramPost);

  if (!rawMetadata) {
    console.warn(`⚠️  No metadata generated for ${instagramPost.instagram_post_url}, skipping...`);
    return;
  }

  // DEV Save File
  // instagram_post_XXXXXXXX_s02_meta_[provider]_[model]_raw.txt
  saveDataToLocal(rawMetadata, `instagram_post_${getInstagramPostId(instagramPost.instagram_post_url)}_s02_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}`, "raw", "txt", "../data/metaInstagram");

  parsedMetadata = await metadataExtractor.parseResponse(rawMetadata);

  if (!parsedMetadata) {
    console.warn(`⚠️  No parsed metadata generated for ${instagramPost.instagram_post_url}, skipping...`);
    return;
  }

  // DEV Save File
  // instagram_post_XXXXXXXX_s03_meta_[provider]_[model]_parsed.json
  saveDataToLocal(parsedMetadata, `instagram_post_${getInstagramPostId(instagramPost.instagram_post_url)}_s03_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}`, "parsed", "json", "../data/metaInstagram");

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
  if (parsedMetadata) {
    if (parsedMetadata.info_country.length > 0) {
      metadata.info_country = parsedMetadata.info_country;
    }
    if (parsedMetadata.info_city.length > 0) {
      metadata.info_city = parsedMetadata.info_city;
    }
    if (parsedMetadata.info_district.length > 0) {
      metadata.info_district = parsedMetadata.info_district;
    }
    if (parsedMetadata.info_neighborhood.length > 0) {
      metadata.info_neighborhood = parsedMetadata.info_neighborhood;
    }
    if (parsedMetadata.info_category.length > 0) {
      metadata.info_category = parsedMetadata.info_category;
    }
    if (parsedMetadata.info_name.length > 0) {
      metadata.info_name = parsedMetadata.info_name;
    }
    if (parsedMetadata.info_special_tag.length > 0) {
      metadata.info_special_tag = parsedMetadata.info_special_tag;
    }
    if (parsedMetadata.info_influencer.length > 0) {
      metadata.info_influencer = parsedMetadata.info_influencer;
    }
    if (parsedMetadata.info_season.length > 0) {
      metadata.info_season = parsedMetadata.info_season;
    }
    if (parsedMetadata.info_time_of_day.length > 0) {
      metadata.info_time_of_day = parsedMetadata.info_time_of_day;
    }
    if (parsedMetadata.info_activity_type.length > 0) {
      metadata.info_activity_type = parsedMetadata.info_activity_type;
    }
    if (parsedMetadata.info_target_audience.length > 0) {
      metadata.info_target_audience = parsedMetadata.info_target_audience;
    }
    if (parsedMetadata.info_reservation_required) {
      metadata.info_reservation_required = parsedMetadata.info_reservation_required;
    }
    // if (extractedMetadata.info_travel_tips.length > 0) {
    //   metadata.info_travel_tips = extractedMetadata.info_travel_tips;
    // }
    if (parsedMetadata.language) {
      metadata.language = parsedMetadata.language;
    }
    if (parsedMetadata.sentimentScore) {
      metadata.sentimentScore = parsedMetadata.sentimentScore;
    }
    if (parsedMetadata.mainTopic) {
      metadata.mainTopic = parsedMetadata.mainTopic;
    }
    if (parsedMetadata.confidence_score) {
      metadata.confidence_score = parsedMetadata.confidence_score;
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

  await DBSqlInstagramPost.updateByPostUrl(instagramPost.instagram_post_url, {
    info_country: parsedMetadata?.info_country,
    info_city: parsedMetadata?.info_city,
    info_district: parsedMetadata?.info_district,
    info_neighborhood: parsedMetadata?.info_neighborhood,
    info_category: parsedMetadata?.info_category,
    info_name: parsedMetadata?.info_name,
    info_special_tag: parsedMetadata?.info_special_tag,
    info_influencer: parsedMetadata?.info_influencer,
    info_season: parsedMetadata?.info_season,
    info_time_of_day: parsedMetadata?.info_time_of_day,
    info_activity_type: parsedMetadata?.info_activity_type,
    // info_target_audience: parsedMetadata?.info_target_audience,
    info_reservation_required: parsedMetadata?.info_reservation_required,
    info_travel_tips: parsedMetadata?.info_travel_tips,
  });

  console.log(`✓ Completed for ${instagramPost.instagram_post_url}`);
}
