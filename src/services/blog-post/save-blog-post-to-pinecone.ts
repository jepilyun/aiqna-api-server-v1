import {
  PINECONE_INDEX_NAME,
  TPineconeMetadata,
  IPineconeVectorMetadataForBlogPost,
  TPineconeVector,
  TSqlBlogPostDetail,
} from "aiqna_common_v1";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { MetadataGeneratorBlogPost } from "../metadata-generator/metadata-generator-blog-post.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.js";
import { chunkBlogPostContent } from "../chunk/chunk-blog-post.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import { ERequestCreateContentType } from "../../consts/const.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
export async function saveBlogPostToPinecone(
  blogPost: TSqlBlogPostDetail,
  blogPostMetadata: Partial<IPineconeVectorMetadataForBlogPost>,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const provider = new OpenAIEmbeddingProvider();
  const embeddingModel = modelName || provider.getDefaultModel();
  const metadataExtractor = new MetadataGeneratorBlogPost();

  const contentKey = ContentKeyManager.createContentKey(
    ERequestCreateContentType.Blog,
    blogPost.blog_post_url,
  );

  // 콘텐츠 준비
  let content = "";
  if (blogPost.content) {
    content = blogPost.content;
  } else if (blogPost.og_description) {
    content = blogPost.og_description;
  } else if (blogPost.og_title) {
    content = blogPost.og_title;
  }

  if (!content) {
    console.warn("⚠️ No content to process for:", blogPost.blog_post_url);
    return;
  }

  // 청크 생성
  const chunks = chunkBlogPostContent(content, {
    maxChars: 800, // ✅ 800자로 줄임
    overlapChars: 100, // ✅ 100자로 줄임
  });
  console.log(`chunks:>>>>>>>>>>`, chunks);
  console.log(
    `📦 Created ${chunks.length} chunks for ${blogPost.blog_post_url}`,
  );

  if (chunks.length === 0) {
    console.warn("⚠️ No chunks generated, skipping...");
    return;
  }

  // 각 청크에 대해 벡터 생성
  const vectors: TPineconeVector[] = await Promise.all(
    chunks.map(async (chunk, idx) => {
      // 로그 (첫 2개만)
      if (idx < 2) {
        console.log(`\n📄 Chunk ${idx}:`);
        console.log(`   Length: ${chunk.text.length} chars`);
        console.log(`   Preview: ${chunk.text.substring(0, 80)}...`);
      }

      // 1. 임베딩 생성 (청크 텍스트 사용)
      const embedding = await provider.generateEmbedding(
        chunk.text,
        embeddingModel,
      );

      // 2. ✅ 청크별 메타데이터 추출 - 각 청크의 텍스트로 분석
      let extractedMetadata: TAnalyzedContentMetadata | null = null;
      try {
        // ✅ 청크 텍스트로 임시 객체 생성
        const chunkBlogPost: TSqlBlogPostDetail = {
          ...blogPost,
          content: chunk.text, // ✅ 각 청크의 실제 텍스트 사용
        };

        extractedMetadata =
          await metadataExtractor.generateMetadataFromBlogPost(chunkBlogPost);

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
          `⚠️ Metadata extraction failed for chunk ${idx}:`,
          metadataError,
        );
      }

      // 청크 ID 생성
      const chunkId = ContentKeyManager.createChunkId(contentKey, idx);

      const metadata: TPineconeMetadata = {
        // ✅ content 제외하고 나머지만 포함
        ...Object.fromEntries(
          Object.entries(blogPostMetadata).filter(
            ([key]) => key !== "blog_content",
          ),
        ),
        blog_post_url: blogPost.blog_post_url,
        chunk_index: idx,
        chunk_id: chunkId,
        text: chunk.text, // ✅ 각 청크의 실제 텍스트
        text_length: chunk.text.length,
        embedding_model: embeddingModel,
        embedding_dimensions: provider.getDimensions(embeddingModel),
        created_at: new Date().toISOString(),
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

      return {
        id: chunkId,
        values: embedding,
        metadata,
      };
    }),
  );

  // Pinecone 배치 업로드
  console.log(`\n💾 Uploading ${vectors.length} vectors to Pinecone...`);
  await DBPinecone.upsertBatch(indexName, vectors, 100);

  console.log(
    `✅ Completed ${chunks.length} chunks for ${blogPost.blog_post_url}\n`,
  );
}
