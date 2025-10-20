import {
  TSqlProcessingLogInstagramPost,
  TSqlInstagramPostDetail,
  TSqlInstagramPostDetailInsert,
} from "aiqna_common_v1";
import DBSqlProcessingLogInstagramPost from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import DBSqlInstagramPost from "../../db-ctrl/db-ctrl-sql/db-sql-instagram-post.js";
import { handleProcessingError } from "../../services/handle-processing-error.js";
import { fetchInstagramPostHTMLMetadata } from "../../services/instagram-post/fetch-instagram-post-html-metadata.js";
import { generateVectorMetadataInstagramPost } from "../../services/instagram-post/generate-vector-metadata-instagram-post.js";
import { saveInstagramPostToPinecone } from "../../services/instagram-post/save-instagram-post-to-pinecone.js";
import { ERequestCreateContentType } from "../../consts/const.js";
import { EProcessingStatusType } from "../../consts/const.js";

/**
 * processCreateInstagramPost
 * Instagram Post 데이터 처리 (Fetch → Pinecone 저장)
 *
 * @param instagramPostUrl - Instagram 포스트 URL (필수)
 * @param description - 포스트 설명
 * @param userId - 사용자 ID
 * @param userProfileUrl - 사용자 프로필 URL
 * @param postDate - 게시 날짜
 * @param tags - 태그 배열
 * @returns 처리 결과
 */
export async function registerInstagramPost(
  instagramPostUrl: string,
  description: string | null = null,
  userId: string | null = null,
  userProfileUrl: string | null = null,
  postDate: string | null = null,
  tags: string[] | null = null,
): Promise<{ success: boolean; instagramPostUrl: string }> {
  try {
    console.log(`\n🚀 Starting Instagram post processing: ${instagramPostUrl}`);

    const logResult = await DBSqlProcessingLogInstagramPost.selectByPostUrl(instagramPostUrl);
    const log = logResult.data?.[0];

    // 1. Instagram Metadata 처리
    const instagramPost = await processInstagramPost(
      instagramPostUrl,
      description,
      userId,
      userProfileUrl,
      postDate,
      tags,
      log,
    );

    // 2. Pinecone 저장
    await processInstagramPostToPinecone(instagramPost, log);

    console.log(
      `✅ Instagram post processing completed: ${instagramPostUrl}\n`,
    );
    return { success: true, instagramPostUrl };
  } catch (error) {
    console.error(
      `❌ Instagram post processing failed: ${instagramPostUrl}`,
      error,
    );

    await handleProcessingError(
      ERequestCreateContentType.Instagram,
      instagramPostUrl,
      error,
      0,
    );

    throw error;
  }
}

/**
 * 1. Fetch Instagram Content
 * Instagram 메타데이터 가져오기 및 DB 저장
 */
async function processInstagramPost(
  instagramPostUrl: string,
  description: string | null = null,
  userId: string | null = null,
  userProfileUrl: string | null = null,
  postDate: string | null = null,
  tags: string[] | null = null,
  log?: TSqlProcessingLogInstagramPost,
): Promise<TSqlInstagramPostDetail> {
  // 이미 처리된 경우 스킵
  if (log?.is_data_fetched) {
    console.log("✅ Data already fetched, checking DB...");
    const existing = await DBSqlInstagramPost.selectByPostUrl(instagramPostUrl);
    if (existing.data?.[0]) {
      console.log("✅ Data exists in DB, returning...");
      return existing.data[0];
    }
  }

  // DB에서 먼저 확인
  const existing = await DBSqlInstagramPost.selectByPostUrl(instagramPostUrl);
  if (existing.data?.[0]) {
    console.log("✅ Data already exists in DB, returning...");
    return existing.data[0];
  }

  // 데이터가 없으면 새로 가져오기
  console.log("📥 No data found, fetching new data...");

  return await withRetry(
    async () => {
      const metadata = await fetchInstagramPostHTMLMetadata(instagramPostUrl);

      // TInstagramPostHTMLMetadata → TSqlInstagramPostDetailInsert 매핑
      const insertData: TSqlInstagramPostDetailInsert = {
        instagram_post_url: instagramPostUrl,
        description: description,
        user_id: userId,
        user_profile_url: userProfileUrl,
        published_date: postDate,
        tags: tags ?? [],
        og_title: metadata.og_title,
        og_description: metadata.og_description,
        og_image: metadata.og_image,
        og_url: metadata.og_url,
        og_ios_url: metadata.og_ios_url,
        og_android_package: metadata.og_android_package,
        og_android_url: metadata.og_android_url,
        local_image_url: metadata.local_image_url,
      };

      console.log("💾 Inserting Instagram post data...");
      await DBSqlInstagramPost.upsert(insertData);

      // Processing Log 업데이트
      await DBSqlProcessingLogInstagramPost.upsert({
        instagram_post_url: instagramPostUrl,
        processing_status: EProcessingStatusType.processing,
        is_data_fetched: true,
      });

      // 방금 저장한 데이터 조회
      const created =
        await DBSqlInstagramPost.selectByPostUrl(instagramPostUrl);

      if (!created.data?.[0]) {
        throw new Error(
          "Failed to create Instagram post data - data not found after insert",
        );
      }

      console.log("✅ Instagram post data saved to DB");
      return created.data[0];
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Fetch Instagram post",
    },
  );
}

/**
 * 2. Pinecone 처리
 * Instagram 포스트를 벡터화하여 Pinecone에 저장
 */
async function processInstagramPostToPinecone(
  instagramPost: TSqlInstagramPostDetail,
  log?: TSqlProcessingLogInstagramPost,
): Promise<void> {
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = generateVectorMetadataInstagramPost(instagramPost);
      await saveInstagramPostToPinecone(instagramPost, metadata);

      await DBSqlProcessingLogInstagramPost.updateByPostUrl(
        instagramPost.instagram_post_url,
        {
          instagram_post_url: instagramPost.instagram_post_url,
          is_pinecone_processed: true,
          processing_status: EProcessingStatusType.completed, // ✅ enum 사용
        },
      );

      console.log("✅ Pinecone processing completed");
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Pinecone processing",
    },
  );
}
