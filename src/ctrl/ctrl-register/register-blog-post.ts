import {
  TSqlProcessingLogBlogPost,
  TSqlBlogPostDetail,
  TSqlBlogPostDetailInsert,
} from "aiqna_common_v1";
import DBSqlProcessingLogBlogPost from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { fetchBlogPostHTMLMetadata } from "../../services/blog-post/fetch-blog-post-html-metadata.js";
import DBSqlBlogPost from "../../db-ctrl/db-ctrl-sql/db-sql-blog-post.js";
import { handleProcessingError } from "../../services/handle-processing-error.js";
import { saveBlogPostToPinecone } from "../../services/blog-post/save-blog-post-to-pinecone.js";
import { ERequestCreateContentType } from "../../consts/const.js";
import { EProcessingStatusType } from "../../consts/const.js";

/**
 * Blog Post 데이터 처리 (Fetch → Pinecone 저장)
 * @param bUrl - 블로그 포스트 URL (필수)
 * @param bTitle - 블로그 제목 (필수)
 * @param bContent - 블로그 본문 (필수)
 * @param bPublishedDate - 발행 날짜
 * @param bTags - 태그 배열
 * @param bPlatform - 플랫폼명 (예: "Medium", "Notion")
 * @param bPlatformUrl - 플랫폼 URL
 * @returns 처리 결과
 */
export async function registerBlogPost(
  bUrl: string,
  bTitle: string,
  bContent: string,
  bPublishedDate: string | null = null,
  bTags: string[] | null = null,
  bPlatform: string | null = null,
  bPlatformUrl: string | null = null,
): Promise<{ success: boolean; blogUrl: string }> {
  try {
    console.log(`\n🚀 Starting blog post processing: ${bUrl}`);

    const logResult = await DBSqlProcessingLogBlogPost.selectByPostUrl(bUrl);
    const log = logResult.data?.[0];

    // 1. Blog Metadata 처리
    const blogPost = await processBlogPost(
      bUrl,
      bTitle,
      bContent,
      bPublishedDate,
      bTags,
      bPlatform,
      bPlatformUrl,
      log,
    );

    // 2. Pinecone 저장
    await processBlogPostToPinecone(blogPost, log);

    console.log(`✅ Blog post processing completed: ${bUrl}\n`);
    return { success: true, blogUrl: bUrl };
  } catch (error) {
    console.error(`❌ Blog post processing failed: ${bUrl}`, error);

    await handleProcessingError(
      ERequestCreateContentType.Blog,
      bUrl,
      error,
      0, // retryCount는 더 이상 필요 없지만 handleProcessingError가 요구하므로 0 전달
    );

    throw error;
  }
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
  log?: TSqlProcessingLogBlogPost,
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
  log?: TSqlProcessingLogBlogPost,
): Promise<void> {
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = {
        blog_post_url: blogPost.blog_post_url, // Instagram 게시물 URL
        title: blogPost.title, // Blog 제목
        image: blogPost.og_image ?? undefined, // Blog 이미지
        published_date: blogPost.published_date ?? undefined, // Blog 게시 날짜 (ISO 8601 형식)
        local_image_url: blogPost.local_image_url ?? undefined, // Blog 로컬 이미지 URL
        tags: blogPost.tags, // Blog 태그
        blog_platform: blogPost.platform ?? "Unknown", // Blog 플랫폼
        blog_platform_url: blogPost.platform_url ?? "Unknown", // Blog 플랫폼 URL
      };

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
