import { youtube_v3 } from "googleapis";
import DBSqlProcessingLogYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-youtube-video.js";
import { fetchYoutubeVideoApiData } from "./youtube-video/fetch-youtube-video-api-data.js";
import DBSqlYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-youtube-video.js";
import { EProcessingStatusType, MAX_RETRIES } from "../../consts/const.js";
import { isRetryableError } from "../../utils/is-retryable-error.js";
import { sleep } from "../../utils/sleep.js";
import { TYouTubeTranscriptStandardFormat, TPineconeVectorMetadataForContent, TSqlYoutubeVideoProcessingLog } from "aiqna_common_v1";
import { saveYouTubeTranscriptsToDb } from "./youtube-video/save-youtube-transcripts-to-db.js";
import DBSqlYoutubeVideoTranscript from "../../ctrl-db/ctrl-db-sql/db-sql-youtube-video-transcript.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "./youtube-video/convert-youtube-transcript-segments-to-standard.js";
import { saveYouTubeTranscriptsToPineconeWithProviders } from "./youtube-video/save-youtube-transcripts-to-pinecone.js";


/**
 * createContentYouTubeVideo
 * YouTube 비디오 데이터 처리
 * @param videoId
 * @returns
 */
// create-content-youtube-video.ts

/**
 * YouTube 비디오 전체 처리 오케스트레이터
 */
export async function createContentYouTubeVideo(
  videoId: string, 
  retryCount = 0
) {
  try {
    const log = await getProcessingLogYouTubeVideo(videoId);

    // 1. API 데이터 처리
    const videoData = await processYouTubeVideoApiData(videoId, log, retryCount);

    // 2. 트랜스크립트 처리
    const transcripts = await processYouTubeVideoTranscripts(videoId, log, retryCount);

    // 3. Pinecone 저장
    await processYouTubeVideoToPinecone(videoId, videoData, transcripts, log, retryCount);

    return { success: true, videoId };
  } catch (error) {
    await handleProcessingError(videoId, error, retryCount);
    throw error;
  }
}

/**
 * Get 
 * @param videoId 
 * @returns 
 */
async function getProcessingLogYouTubeVideo(videoId: string) {
  const result = await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
  return result.data?.[0];
}

/**
 * 1. YouTube API 데이터 처리
 */
async function processYouTubeVideoApiData(
  videoId: string,
  log: TSqlYoutubeVideoProcessingLog,
  retryCount: number
): Promise<youtube_v3.Schema$Video> {
  if (!log?.is_api_data_fetched) {
    return await withRetry(
      async () => {
        const data = await fetchYoutubeVideoApiData(videoId);
        await DBSqlYoutubeVideo.upsert(data);
        await DBSqlProcessingLogYoutubeVideo.upsert({
          video_id: videoId,
          processing_status: EProcessingStatusType.processing,
          is_api_data_fetched: true,
        });
        return data;
      },
      retryCount,
      'API fetch'
    );
  }

  const existing = await DBSqlYoutubeVideo.selectByVideoId(videoId);
  if (!existing.data?.[0]) {
    throw new Error("Failed to fetch YouTube Video API data");
  }
  return existing.data[0];
}

/**
 * 2. 트랜스크립트 처리
 */
async function processYouTubeVideoTranscripts(
  videoId: string,
  log: TSqlYoutubeVideoProcessingLog,
  retryCount: number
): Promise<TYouTubeTranscriptStandardFormat[]> {
  if (!log?.is_transcript_fetched) {
    return await withRetry(
      async () => {
        const transcripts = await saveYouTubeTranscriptsToDb(videoId, ["en", "ko"]);
        await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
          is_transcript_fetched: true,
        });
        return transcripts;
      },
      retryCount,
      'Transcript fetch'
    );
  }

  return await loadExistingTranscripts(videoId);
}

/**
 * 3. Pinecone 처리
 */
async function processYouTubeVideoToPinecone(
  videoId: string,
  videoData: youtube_v3.Schema$Video,
  transcripts: TYouTubeTranscriptStandardFormat[],
  log: TSqlYoutubeVideoProcessingLog,
  retryCount: number
): Promise<void> {
  if (log?.is_pinecone_processed || transcripts.length === 0) {
    return;
  }

  await withRetry(
    async () => {
      const metadata = convertYouTubeApiDataToPineconeVideoMetadata(videoData);
      await saveYouTubeTranscriptsToPineconeWithProviders(transcripts, metadata);
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
        is_pinecone_processed: true,
        processing_status: "completed",
      });
    },
    retryCount,
    'Pinecone processing'
  );
}

/**
 * 재시도 로직 추상화
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retryCount: number,
  operationName: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`${operationName} failed:`, error);

    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      console.log(`Retrying ${operationName} (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(1000 * (retryCount + 1));
      return withRetry(fn, retryCount + 1, operationName);
    }

    throw error;
  }
}


async function loadExistingTranscripts(
  videoId: string
): Promise<TYouTubeTranscriptStandardFormat[]> {
  const existingTranscripts = await DBSqlYoutubeVideoTranscript.selectByVideoId(videoId);

  const transcripts = existingTranscripts.data
    ?.map((t) => {
      if (!t.segments_json) {
        console.warn(`No segments_json for ${t.language}`);
        return null;
      }

      // 타입 체크 후 처리
      let parsedSegments;

      if (typeof t.segments_json === "string") {
        try {
          parsedSegments = JSON.parse(t.segments_json);
        } catch (error) {
          console.error(`Failed to parse segments_json for ${t.language}:`, error);
          return null;
        }
      } else {
        parsedSegments = t.segments_json;
      }

      const segments = convertYouTubeTranscriptSegmentsToStandard(parsedSegments);

      return {
        videoId,
        language: t.language,
        segments,
      };
    })
    .filter((t): t is TYouTubeTranscriptStandardFormat => t !== null) || [];

  return transcripts;
}




// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleProcessingError(videoId: string, error: any, retryCount: number) {
  await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
    processing_status: "failed",
    error_message: error?.message ? error.message : "",
    retry_count: retryCount,
  });
}


/**
 * Convert 
 * @param videoData 
 * @returns 
 */
function convertYouTubeApiDataToPineconeVideoMetadata(
  videoData: youtube_v3.Schema$Video,
): Partial<TPineconeVectorMetadataForContent> {
  return {
    video_id: videoData.id || "",
    title: videoData.snippet?.title || "",
    channel_title: videoData.snippet?.channelTitle || "",
    channel_id: videoData.snippet?.channelId || "",
    published_date: videoData.snippet?.publishedAt || "",
    thumbnail_url: videoData.snippet?.thumbnails?.high?.url || "",
    duration: videoData.contentDetails?.duration || "",
    view_count: parseInt(videoData.statistics?.viewCount || "0"),
    like_count: parseInt(videoData.statistics?.likeCount || "0"),
  };
}




