import { youtube_v3 } from "googleapis";
import DBSqlProcessingLogYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-youtube-video.js";
import { fetchYoutubeVideoApiData } from "./youtube-video/fetch-youtube-video-api-data.js";
import DBSqlYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-youtube-video.js";
import { TYouTubeTranscriptStandardFormat, TPineconeVectorMetadataForContent, TSqlYoutubeVideoProcessingLog, EProcessingStatusType, ERequestCreateContentType } from "aiqna_common_v1";
import { saveYouTubeTranscriptsToDb } from "./youtube-video/save-youtube-transcripts-to-db.js";
import DBSqlYoutubeVideoTranscript from "../../ctrl-db/ctrl-db-sql/db-sql-youtube-video-transcript.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "./youtube-video/convert-youtube-transcript-segments-to-standard.js";
import { saveYouTubeTranscriptsToPineconeWithProviders } from "./youtube-video/save-youtube-transcripts-to-pinecone.js";
import { withRetry } from "../../utils/retry-process.js";
import { handleProcessingError } from "../../utils/handle-processing-error.js";


/**
 * createContentYouTubeVideo
 * YouTube 비디오 데이터 처리
 * @param videoId
 * @returns
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
    await handleProcessingError(ERequestCreateContentType.YoutubeVideo, videoId, error, retryCount);
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




