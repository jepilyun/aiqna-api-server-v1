import {
  PINECONE_INDEX_NAME,
  TPineconeMetadata,
  TPineconeVectorMetadataForContent,
  TPineconeVector,
  TSqlInstagramPostDetail,
  ERequestCreateContentType,
} from "aiqna_common_v1";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { MetadataGeneratorInstagramPost } from "../metadata-generator/metadata-generator-instagram-post.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { EmbeddingProviderFactory } from "../embedding/embedding-provider-factory.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
export async function saveInstagramPostToPinecone(
  instagramPost: TSqlInstagramPostDetail,
  instagramPostMetadata: Partial<TPineconeVectorMetadataForContent>,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const provider = EmbeddingProviderFactory.createProvider("openai");
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
    if (extractedMetadata.categories.length > 0) {
      metadata.categories = extractedMetadata.categories;
    }
    if (extractedMetadata.keywords.length > 0) {
      metadata.keywords = extractedMetadata.keywords;
    }
    if (extractedMetadata.locations.length > 0) {
      metadata.locations = extractedMetadata.locations;
    }
    if (extractedMetadata.names.length > 0) {
      metadata.names = extractedMetadata.names;
    }
    metadata.confidence_score = extractedMetadata.confidence_score;
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
