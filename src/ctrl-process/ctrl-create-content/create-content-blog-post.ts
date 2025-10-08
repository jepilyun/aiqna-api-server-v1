import { 
  TSqlBlogPostProcessingLog, 
  ERequestCreateContentType, 
  EProcessingStatusType, 
  TSqlBlogPostDetail, 
  TSqlBlogPostDetailInsert 
} from "aiqna_common_v1";
import DBSqlProcessingLogBlogPost from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-blog-post.js";
import { withRetry } from "../../utils/retry-process.js";
import { fetchBlogPostHTMLMetadata } from "./blog-post/fetch-blog-post-html-metadata.js";
import DBSqlBlogPost from "../../ctrl-db/ctrl-db-sql/db-sql-blog-post.js";
import { handleProcessingError } from "../../utils/handle-processing-error.js";
import { convertBlogDataToPineconeMetadata } from "./blog-post/convert-blog-data-to-pinecone-metadata.js";
import { saveBlogPostToPinecone } from "./blog-post/save-blog-post-to-pinecone.js";

/**
 * createContentBlogPost
 * Blog Post데이터 처리
 */
export async function createContentBlogPost(
  blogUrl: string, 
  blogTitle: string,
  blogContent: string,
  blogPublishedDate: string | null = null,
  blogTags: string[] | null = null,
  blogPlatform: string | null = null,
  blogPlatformUrl: string | null = null,
  retryCount = 0
) {
  try {
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
      retryCount
    );

    // 2. Pinecone 저장
    await processBlogPostToPinecone(
      blogPost, // ✅ blogUrl 대신 blogPost 객체 전달
      log,
      retryCount
    );

    return { success: true, blogUrl };
  } catch (error) {
    await handleProcessingError(ERequestCreateContentType.Blog, blogUrl, error, retryCount);
    throw error;
  }
}

/**
 * Get Processing Log
 */
async function getProcessingLogBlogPost(blogUrl: string) {
  const result = await DBSqlProcessingLogBlogPost.selectByPostUrl(blogUrl);
  return result.data?.[0];
}

/**
 * 1. Fetch Blog Content
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
  retryCount: number = 0
): Promise<TSqlBlogPostDetail> {
  // 먼저 DB에서 데이터가 실제로 있는지 확인
  const existing = await DBSqlBlogPost.selectByPostUrl(blogUrl);

  // 데이터가 이미 있으면 바로 반환
  if (existing.data?.[0]) {
    console.log("✅ Data already exists in DB, returning...");
    return existing.data[0];
  }

  // 데이터가 없으면 새로 가져오기
  console.log("📥 No data found, fetching new data...");
  
  return await withRetry(
    async () => {
      const metadata = await fetchBlogPostHTMLMetadata(blogUrl);

      // ✅ TSqlBlogPostDetailInsert 매핑
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

      console.log("💾 Inserting data:", insertData);
      
      // ✅ DBSqlBlogPost 사용
      await DBSqlBlogPost.upsert(insertData);

      // ✅ Processing Log 업데이트
      await DBSqlProcessingLogBlogPost.upsert({
        blog_post_url: blogUrl,
        processing_status: EProcessingStatusType.processing,
        is_data_fetched: true,
      });

      // 방금 저장한 데이터 조회
      const created = await DBSqlBlogPost.selectByPostUrl(blogUrl);
      console.log("✅ Created record:", created);

      if (!created.data?.[0]) {
        throw new Error("Failed to create Blog Post data - data not found after insert");
      }

      return created.data[0];
    },
    retryCount,
    'API fetch'
  );
}

/**
 * 2. Pinecone 처리
 */
async function processBlogPostToPinecone(
  blogPost: TSqlBlogPostDetail, // ✅ 파라미터 타입 수정
  log?: TSqlBlogPostProcessingLog,
  retryCount: number = 0
): Promise<void> {
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = convertBlogDataToPineconeMetadata(blogPost);
      await saveBlogPostToPinecone(blogPost, metadata);
      
      // ✅ DBSqlProcessingLogBlogPost 사용
      await DBSqlProcessingLogBlogPost.updateByPostUrl(blogPost.blog_post_url, {
        is_pinecone_processed: true,
        processing_status: EProcessingStatusType.completed,
      });
      
      console.log("✅ Pinecone processing completed");
    },
    retryCount,
    'Pinecone processing'
  );
}