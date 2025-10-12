import {
  EProcessingStatusType,
  ERequestCreateContentType,
} from "aiqna_common_v1";
import DBSqlProcessingLogYoutubeVideo from "../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import DBSqlProcessingLogInstagramPost from "../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";
import DBSqlProcessingLogBlogPost from "../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";
import DBSqlProcessingLogText from "../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";

/**
 * 처리 에러 핸들링 및 로그 업데이트
 * @param type - 콘텐츠 타입
 * @param key - 고유 키 (video_id, post_url, hash_key 등)
 * @param error - 발생한 에러
 * @param retryCount - 재시도 횟수
 */
export async function handleProcessingError(
  type: string,
  key: string,
  error: unknown,
  retryCount: number,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  const data = {
    processing_status: EProcessingStatusType.failed,
    error_message: errorMessage,
    retry_count: retryCount,
  };

  switch (type) {
    case ERequestCreateContentType.YoutubeVideo:
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(key, data);
      break;
    case ERequestCreateContentType.Instagram:
      await DBSqlProcessingLogInstagramPost.updateByPostUrl(key, data);
      break;
    case ERequestCreateContentType.Blog:
      await DBSqlProcessingLogBlogPost.updateByPostUrl(key, data);
      break;
    case ERequestCreateContentType.Text:
      await DBSqlProcessingLogText.updateByHashKey(key, data);
      break;
    default:
      console.warn(`Unknown content type: ${type}`);
  }
}
