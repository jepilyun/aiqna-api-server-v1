import { TSqlYoutubeVideoDetail } from "aiqna_common_v1";
import DBSqlProcessingLogYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import { EProcessingStatusType } from "../../consts/const.js";
import DBSqlYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import { handleProcessingError } from "../handle-processing-error.js";
import { ERequestCreateContentType } from "../../consts/const.js";

/**
 * YouTube Vide API Data Fetch
 */
export async function fetchYouTubeVideoDataFromDB(
  videoId: string,
): Promise<TSqlYoutubeVideoDetail | null> {
  try {
    // 상태를 'processing'으로 변경
    await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
      processing_status: EProcessingStatusType.processing,
      processing_started: new Date().toISOString(),
    });

    // 1. Video Data 가져오기 (From DB)
    const videoDataResult = await DBSqlYoutubeVideo.selectByVideoId(videoId);
    const videoData = videoDataResult.data?.[0];

    if (!videoData) {
      throw new Error(`Video data not found for ${videoId}`);
    }

    return videoData;
  } catch (error) {
    console.error(`❌ Job failed: ${videoId}`, error);

    await handleProcessingError(
      ERequestCreateContentType.YoutubeVideo,
      videoId,
      error,
      0,
    );

    return null;
  }
}