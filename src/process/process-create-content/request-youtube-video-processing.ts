import DBSqlProcessingLogYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import { fetchYoutubeVideoApi } from "../../services/youtube-video/fetch-youtube-video-api.js";
import DBSqlYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import { EProcessingStatusType } from "aiqna_common_v1";

/**
 * requestYouTubeVideoProcessing
 * YouTube 비디오 데이터 처리 (API 데이터 + 자막 → Pinecone 저장)
 *
 * @param videoId - YouTube 비디오 ID (필수)
 * @returns 처리 결과
 */
export async function requestYouTubeVideoProcessing(
  videoId: string,
): Promise<{ success: boolean; videoId: string; status: string }> {
  try {
    console.log(`📝 Registering YouTube video for processing log: ${videoId}`);

    // 1. API 데이터만 즉시 가져오기 (가볍고 빠름)
    const videoData = await fetchYoutubeVideoApi(videoId);
    await DBSqlYoutubeVideo.upsert(videoData);

    // 2. Processing Log 등록
    await DBSqlProcessingLogYoutubeVideo.upsert({
      video_id: videoId,
      processing_status: EProcessingStatusType.pending,
      is_api_data_fetched: true,
      is_transcript_exist: true, // 일단 true로 가정 (Worker가 확인)
      is_transcript_fetched: false,
      is_pinecone_processed: false,
    });

    console.log(`✅ Video registered for background processing: ${videoId}`);

    return {
      success: true,
      videoId,
      status: "queued",
    };
  } catch (error) {
    console.error(`❌ Failed to register video: ${videoId}`, error);
    throw error;
  }
}
