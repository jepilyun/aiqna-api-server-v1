import {
  TSqlBlogPostProcessingLog,
  ERequestCreateContentType,
  EProcessingStatusType,
  TSqlBlogPostDetail,
  TSqlBlogPostDetailInsert,
} from "aiqna_common_v1";
import DBSqlProcessingLogBlogPost from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { fetchBlogPostHTMLMetadata } from "../../services/blog-post/fetch-blog-post-html-metadata.js";
import DBSqlBlogPost from "../../db-ctrl/db-ctrl-sql/db-sql-blog-post.js";
import { handleProcessingError } from "../../services/handle-processing-error.js";
import { generateVectorMetadataBlogPost } from "../../services/blog-post/generate-vector-metadata-blog-post.js";
import { saveBlogPostToPinecone } from "../../services/blog-post/save-blog-post-to-pinecone.js";

/**
 * processContentBlogPost
 * Blog Post 데이터 처리 (Fetch → Pinecone 저장)
 *
 * @param blogUrl - 블로그 포스트 URL (필수)
 * @param blogTitle - 블로그 제목 (필수)
 * @param blogContent - 블로그 본문 (필수)
 * @param blogPublishedDate - 발행 날짜
 * @param blogTags - 태그 배열
 * @param blogPlatform - 플랫폼명 (예: "Medium", "Notion")
 * @param blogPlatformUrl - 플랫폼 URL
 * @returns 처리 결과
 */
export async function processContentBlogPost(
  blogUrl: string,
  blogTitle: string,
  blogContent: string,
  blogPublishedDate: string | null = null,
  blogTags: string[] | null = null,
  blogPlatform: string | null = null,
  blogPlatformUrl: string | null = null,
): Promise<{ success: boolean; blogUrl: string }> {
  try {
    console.log(`\n🚀 Starting blog post processing: ${blogUrl}`);

    const log = await getProcessingLogBlogPost(blogUrl);

    // 1. Blog Metadata 처리
    const blogPost = await processBlogPost(
      blogUrl,
      blogTitle,
      blogContent,
      blogPublishedDate,
      blogTags,
      blogPlatform,
      blogPlatformUrl,
      log,
    );

    // 2. Pinecone 저장
    await processBlogPostToPinecone(blogPost, log);

    console.log(`✅ Blog post processing completed: ${blogUrl}\n`);
    return { success: true, blogUrl };
  } catch (error) {
    console.error(`❌ Blog post processing failed: ${blogUrl}`, error);

    await handleProcessingError(
      ERequestCreateContentType.Blog,
      blogUrl,
      error,
      0, // retryCount는 더 이상 필요 없지만 handleProcessingError가 요구하므로 0 전달
    );

    throw error;
  }
}

/**
 * Get Processing Log
 */
async function getProcessingLogBlogPost(
  blogUrl: string,
): Promise<TSqlBlogPostProcessingLog | undefined> {
  const result = await DBSqlProcessingLogBlogPost.selectByPostUrl(blogUrl);
  return result.data?.[0];
}

/**
 * 1. Fetch Blog Content
 * 블로그 메타데이터 가져오기 및 DB 저장
 */
async function processBlogPost(
  blogUrl: string,
  blogTitle: string,
  blogContent: string,
  blogPublishedDate: string | null = null,
  blogTags: string[] | null = null,
  blogPlatform: string | null = null,
  blogPlatformUrl: string | null = null,
  log?: TSqlBlogPostProcessingLog,
): Promise<TSqlBlogPostDetail> {
  // 이미 처리된 경우 스킵
  if (log?.is_data_fetched) {
    console.log("✅ Data already fetched, checking DB...");
    const existing = await DBSqlBlogPost.selectByPostUrl(blogUrl);
    if (existing.data?.[0]) {
      console.log("✅ Data exists in DB, returning...");
      return existing.data[0];
    }
  }

  // DB에서 먼저 확인
  const existing = await DBSqlBlogPost.selectByPostUrl(blogUrl);
  if (existing.data?.[0]) {
    console.log("✅ Data already exists in DB, returning...");
    return existing.data[0];
  }

  // 데이터가 없으면 새로 가져오기
  console.log("📥 No data found, fetching new data...");

  return await withRetry(
    async () => {
      const metadata = await fetchBlogPostHTMLMetadata(blogUrl);

      const insertData: TSqlBlogPostDetailInsert = {
        blog_post_url: blogUrl,
        content: blogContent,
        title: blogTitle,
        og_title: metadata.og_title,
        og_description: metadata.og_description,
        og_image: metadata.og_image,
        og_url: metadata.og_url,
        local_image_url: metadata.local_image_url ?? undefined,
        published_date: blogPublishedDate,
        tags: blogTags ?? [],
        platform: blogPlatform ?? undefined,
        platform_url: blogPlatformUrl ?? undefined,
      };

      console.log("💾 Inserting blog post data...");
      await DBSqlBlogPost.upsert(insertData);

      // Processing Log 업데이트
      await DBSqlProcessingLogBlogPost.upsert({
        blog_post_url: blogUrl,
        processing_status: EProcessingStatusType.processing,
        is_data_fetched: true,
      });

      // 방금 저장한 데이터 조회
      const created = await DBSqlBlogPost.selectByPostUrl(blogUrl);

      if (!created.data?.[0]) {
        throw new Error(
          "Failed to create blog post data - data not found after insert",
        );
      }

      console.log("✅ Blog post data saved to DB");
      return created.data[0];
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Fetch blog post",
    },
  );
}

/**
 * 2. Pinecone 처리
 * 블로그 포스트를 벡터화하여 Pinecone에 저장
 */
async function processBlogPostToPinecone(
  blogPost: TSqlBlogPostDetail,
  log?: TSqlBlogPostProcessingLog,
): Promise<void> {
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = generateVectorMetadataBlogPost(blogPost);
      await saveBlogPostToPinecone(blogPost, metadata);

      // Processing Log 업데이트
      await DBSqlProcessingLogBlogPost.updateByPostUrl(blogPost.blog_post_url, {
        is_pinecone_processed: true,
        processing_status: EProcessingStatusType.completed,
      });

      console.log("✅ Pinecone processing completed");
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Pinecone processing",
    },
  );
}
