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
import { ERequestCreateContentType, METADATA_GENERATOR_MODEL, METADATA_GENERATOR_MODEL_NAME, METADATA_GENERATOR_PROVIDER } from "../../consts/const.js";
import { saveDataToLocal } from "../../utils/save-file.js";

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
  const metadataExtractor = new MetadataGeneratorBlogPost({
    provider: METADATA_GENERATOR_PROVIDER,              // "openai" 도 가능
    model: METADATA_GENERATOR_MODEL,
  });

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

  const rawMetadata = await metadataExtractor.generateMetadataFromBlogPost(blogPost);

  if (!rawMetadata) {
    console.warn(`⚠️  No metadata generated for ${blogPost.blog_post_url}, skipping...`);
    return;
  }

  // DEV Save File
  // blog_post_XXXXXXXX_s02 full_content_meta_[provider]_[model]_raw.txt
  saveDataToLocal(rawMetadata, `blog_post_${blogPost.blog_post_url}_s02_full_content_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}`, "raw", "txt", "../data/metaBlog");

  const parsedMetadata = await metadataExtractor.parseResponse(rawMetadata);

  if (!parsedMetadata) {
    console.warn(`⚠️  No parsed metadata generated for ${blogPost.blog_post_url}, skipping...`);
    return;
  }

  // DEV Save File
  // blog_post_XXXXXXXX_s03 full_content_meta_[provider]_[model]_parsed.json
  saveDataToLocal(parsedMetadata, `blog_post_${blogPost.blog_post_url}_s03_full_content_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}`, "parsed", "json", "../data/metaBlog");

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
      let chunkParsedMetadata: TAnalyzedContentMetadata | null = null;
      try {
        // ✅ 청크 텍스트로 임시 객체 생성
        const chunkBlogPost: TSqlBlogPostDetail = {
          ...blogPost,
          content: chunk.text, // ✅ 각 청크의 실제 텍스트 사용
        };
  
        const chunkRawMetadata =
          await metadataExtractor.generateMetadataFromBlogPost(chunkBlogPost);
  
        // DEV Save File
        // blog_post_XXXXXXXX_s05_chunk_[01]_meta_[provider]_[model]_raw.txt
        await saveDataToLocal(chunkRawMetadata, `blog_post_${blogPost.blog_post_url}_s05_chunk_${idx}_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}_raw`, "raw", "txt", "../data/metaBlog");
  
        if (!chunkRawMetadata) {
          console.warn(`⚠️  No raw metadata generated for chunk ${idx}, continuing without metadata...`);
        } else {
          chunkParsedMetadata = await metadataExtractor.parseResponse(chunkRawMetadata);
  
          if (!chunkParsedMetadata) {
            console.warn(`⚠️  No parsed metadata generated for chunk ${idx}, continuing without metadata...`);
          } else {
            // DEV Save File
            // blog_post_XXXXXXXX_s06_chunk_[01]_meta_[provider]_[model]_parsed.json
            await saveDataToLocal(chunkParsedMetadata, `blog_post_${blogPost.blog_post_url}_s06_chunk_${idx}_meta_${METADATA_GENERATOR_PROVIDER}_${METADATA_GENERATOR_MODEL_NAME}_parsed`, "parsed", "json", "../data/metaBlog");
  
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
  );

  // Pinecone 배치 업로드
  console.log(`\n💾 Uploading ${vectors.length} vectors to Pinecone...`);
  
  await DBPinecone.upsertBatch(indexName, vectors, 100);

  console.log(
    `✅ Completed ${chunks.length} chunks for ${blogPost.blog_post_url}\n`,
  );
}
