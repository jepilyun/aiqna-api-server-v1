import { google, youtube_v3 } from "googleapis";

/**
 * YouTube Data API v3를 사용하여 비디오 메타데이터를 가져옵니다.
 *
 * @param videoId - YouTube 비디오 ID (11자리 문자열)
 * @returns YouTube API의 video 리소스 객체 (snippet, statistics, contentDetails, status, topicDetails 포함)
 * @throws
 * - 비디오를 찾을 수 없는 경우
 * - API 키가 유효하지 않은 경우
 * - API 할당량 초과 시
 * - 네트워크 오류 발생 시
 *
 * @remarks
 * - 환경변수 YOUTUBE_API_KEY에 유효한 YouTube Data API v3 키가 필요합니다
 * - API 할당량: 1회 호출당 1 quota unit 소모
 * - 반환되는 데이터는 YouTube Data API v3의 video 리소스 형식을 따릅니다
 * - PostgreSQL 함수 등 외부 시스템과의 통합을 위해 원본 형식 그대로 반환합니다
 */
export async function fetchYoutubeVideoApiData(
  videoId: string,
): Promise<youtube_v3.Schema$Video> {
  try {
    const youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY, // API 키 필요
    });

    const response = await youtube.videos.list({
      part: [
        "snippet",
        "statistics",
        "contentDetails",
        "status",
        "topicDetails",
      ],
      id: [videoId],
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // PostgreSQL 함수가 기대하는 형식 그대로 반환
    return response.data.items[0];
  } catch (error) {
    console.error("Error fetching video metadata:", error);
    throw error;
  }
}
