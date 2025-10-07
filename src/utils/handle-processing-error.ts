import { EProcessingStatusType, ERequestCreateContentType } from "aiqna_common_v1";
import DBSqlProcessingLogYoutubeVideo from "../ctrl-db/ctrl-db-sql/db-sql-processing-log-youtube-video.js";
import DBSqlProcessingLogInstagramPost from "../ctrl-db/ctrl-db-sql/db-sql-processing-log-instagram-post.js";
import DBSqlProcessingLogBlogPost from "../ctrl-db/ctrl-db-sql/db-sql-processing-log-blog-post.js";
import DBSqlProcessingLogText from "../ctrl-db/ctrl-db-sql/db-sql-processing-log-text.js";

/**
 * @param type 
 * @param key 
 * @param error 
 * @param retryCount 
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleProcessingError(type: string, key: string, error: any, retryCount: number) {
  const data = {
    processing_status: EProcessingStatusType.failed,
    error_message: error?.message ? error.message : "",
    retry_count: retryCount,
  };

  switch (type) {
    case ERequestCreateContentType.YoutubeVideo:
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(key, data);
      break;
    case  ERequestCreateContentType.Instagram:
      await DBSqlProcessingLogInstagramPost.updateByPostUrl(key, data);
      break;
    case ERequestCreateContentType.Blog:
      await DBSqlProcessingLogBlogPost.updateByPostUrl(key, data);
      break;
    case ERequestCreateContentType.Text:
      await DBSqlProcessingLogText.updateByHashKey(key, data);
      break;
  }
  
}
