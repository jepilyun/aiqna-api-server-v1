import {
  PINECONE_INDEX_NAME,
  TPineconeMetadata,
  TPineconeVectorMetadataForContent,
  TPineconeVector,
  TSqlBlogPostDetail,
  ERequestCreateContentType,
} from "aiqna_common_v1";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { BlogPostMetadataAnalyzerByAI } from "./blog-post-metadata-analyzer.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { EmbeddingProviderFactory } from "../../embedding/embedding-provider-factory.js";
import { chunkBlogPostContent } from "./chunk-blog-post-content.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
export async function saveBlogPostToPinecone(
  blogPost: TSqlBlogPostDetail,
  blogPostMetadata: Partial<TPineconeVectorMetadataForContent>,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const provider = EmbeddingProviderFactory.createProvider("openai");
  const embeddingModel = modelName || provider.getDefaultModel();
  const metadataExtractor = new BlogPostMetadataAnalyzerByAI();

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
    minChars: 200, // ✅ 200자로 줄임
  });

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
          await metadataExtractor.analyzeFromBlogPost(chunkBlogPost);

        if (idx < 2) {
          console.log(`   Metadata:`, {
            categories: extractedMetadata?.categories,
            locations: extractedMetadata?.locations,
            keywords: extractedMetadata?.keywords.slice(0, 3),
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
        blog_post_url: blogPost.blog_post_url,
        chunk_index: idx,
        chunk_id: chunkId,
        text: chunk.text, // ✅ 각 청크의 실제 텍스트
        text_length: chunk.text.length,
        embedding_model: embeddingModel,
        embedding_dimensions: provider.getDimensions(embeddingModel),
        created_at: new Date().toISOString(),
        // ✅ content 제외하고 나머지만 포함
        ...Object.fromEntries(
          Object.entries(blogPostMetadata).filter(
            ([key]) => key !== "blog_content",
          ),
        ),
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
