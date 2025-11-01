import DBSqlProcessingLogYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import { fetchYoutubeVideoAPI } from "../../services/youtube-video/fetch-youtube-video-api.js";
import DBSqlYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import { EProcessingStatusType } from "../../consts/const.js";
import { TRegisterRequestYouTubeVideoData } from "../../types/shared.js";

/**
 * YouTube 비디오 요청 등록
 * API 데이터의 경우 즉시 가져오고, Processing Log 등록
 * @param videoId - YouTube 비디오 ID (단일 또는 쉼표 구분 문자열)
 * @returns 처리 결과 배열
 */
export async function registerYouTubeVideo({
  videoId,
  isShorts,
}: TRegisterRequestYouTubeVideoData): Promise<{
  success: boolean;
  uniqueKey: string;
  status: string;
}> {
  if (videoId.length === 0) {
    throw new Error("No valid video IDs provided.");
  }

  try {
    console.log(`📝 Registering YouTube video for processing log: ${videoId}`);

    // 1. API 데이터 즉시 가져오기
    const videoData = await fetchYoutubeVideoAPI(videoId);
    await DBSqlYoutubeVideo.upsert(videoData, isShorts);

    // 2. Processing Log 등록
    await DBSqlProcessingLogYoutubeVideo.upsert({
      video_id: videoId,
      processing_status: EProcessingStatusType.pending,
      is_api_data_fetched: true,
      is_transcript_fetched: false,
      is_pinecone_processed: false,
    });

    console.log(`✅ Video registered for background processing: ${videoId}`);

    return {
      success: true,
      uniqueKey: videoId,
      status: "queued",
    };
  } catch (error) {
    console.error(`❌ Failed to register video: ${videoId}`, error);

    // 실패한 항목도 결과에 포함시키거나, 오류 처리를 다르게 할 수 있습니다.
    return {
      success: false,
      uniqueKey: videoId,
      status: "failed",
    };
    // throw error; // 전체 루프를 중단하지 않도록 error throw를 제거 (필요시)
  }
}
