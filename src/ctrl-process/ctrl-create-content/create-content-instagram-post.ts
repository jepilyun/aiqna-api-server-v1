import { TSqlInstagramPostProcessingLog, ERequestCreateContentType, EProcessingStatusType, TSqlInstagramPostDetail, TSqlInstagramPostDetailInsert } from "aiqna_common_v1";
import DBSqlProcessingLogInstagramPost from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-instagram-post.js";
import { withRetry } from "../../utils/retry-process.js";
import { fetchInstagramPostHTMLMetadata } from "./instagram-post/fetch-instagram-post-html-metadata.js";
import DBSqlInstagramPost from "../../ctrl-db/ctrl-db-sql/db-sql-instagram-post.js";
import { handleProcessingError } from "../../utils/handle-processing-error.js";
import { convertInstagramDataToPineconeMetadata } from "./instagram-post/convert-instagram-data-to-pinecone-metadata.js";
import { saveInstagramPostToPinecone } from "./instagram-post/save-instagram-post-to-pinecone.js";


/**
 * createContentInstagramPost
 * Instagram Post데이터 처리
 * @param instagramUrl
 * @returns
 */
export async function createContentInstagramPost(
  instagramUrl: string, 
  retryCount = 0
) {
  try {
    const log = await getProcessingLogInstagramPost(instagramUrl);

    // // 1. Instagram Metadata 처리
    const instagramPost = await processInstagramPost(instagramUrl, log, retryCount);
    console.log(instagramPost);

    // // 2. Pinecone 저장
    await processInstagramPostToPinecone(instagramPost, log, retryCount);

    return { success: true, instagramUrl };
  } catch (error) {
    await handleProcessingError(ERequestCreateContentType.Instagram, instagramUrl, error, retryCount);
    throw error;
  }
}

/**
 * Get 
 * @param instagramPostUrl 
 * @returns 
 */
async function getProcessingLogInstagramPost(instagramPostUrl: string) {
  const result = await DBSqlProcessingLogInstagramPost.selectByPostUrl(instagramPostUrl);
  return result.data?.[0];
}

/**
 * 1. Fetch Instagram Content
 */
async function processInstagramPost(
  instagramPostUrl: string,
  log: TSqlInstagramPostProcessingLog,
  retryCount: number
): Promise<TSqlInstagramPostDetail> {
  // 먼저 DB에서 데이터가 실제로 있는지 확인
  const existing = await DBSqlInstagramPost.selectByPostUrl(instagramPostUrl);

  // 데이터가 이미 있으면 바로 반환
  if (existing.data?.[0]) {
    console.log("✅ Data already exists in DB, returning...");
    return existing.data[0];
  }

  // 데이터가 없으면 새로 가져오기
  return await withRetry(
    async () => {
      const metadata = await fetchInstagramPostHTMLMetadata(instagramPostUrl);

      // TInstagramPostHTMLMetadata → TSqlInstagramPostDetailInsert 매핑
      const insertData: TSqlInstagramPostDetailInsert = {
        instagram_post_url: instagramPostUrl,
        og_title: metadata.og_title,
        og_description: metadata.og_description,
        og_image: metadata.og_image,
        og_url: metadata.og_url,
        og_ios_url: metadata.og_ios_url,
        og_android_package: metadata.og_android_package,
        og_android_url: metadata.og_android_url,
        local_image_url: metadata.local_image_url,
      };

      // 데이터 업데이트
      await DBSqlInstagramPost.upsert(insertData);

      // Processing Log 업데이트
      await DBSqlProcessingLogInstagramPost.upsert({
        instagram_post_url: instagramPostUrl,
        processing_status: EProcessingStatusType.processing,
        is_data_fetched: true,
      });

      // 방금 저장한 데이터 조회
      const created = await DBSqlInstagramPost.selectByPostUrl(instagramPostUrl);

      if (!created.data?.[0]) {
        throw new Error("Failed to create Instagram Post data - data not found after insert");
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
async function processInstagramPostToPinecone(
  instagramPost: TSqlInstagramPostDetail,
  log: TSqlInstagramPostProcessingLog,
  retryCount: number
): Promise<void> {
  if (log?.is_pinecone_processed) {
    return;
  }

  await withRetry(
    async () => {
      const metadata = convertInstagramDataToPineconeMetadata(instagramPost);
      await saveInstagramPostToPinecone(instagramPost, metadata);
      await DBSqlProcessingLogInstagramPost.updateByPostUrl(instagramPost.instagram_post_url, {
        is_pinecone_processed: true,
        processing_status: "completed",
      });
    },
    retryCount,
    'Pinecone processing'
  );
}
