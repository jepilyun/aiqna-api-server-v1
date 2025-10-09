import { youtube_v3 } from "googleapis";
import DBSqlProcessingLogYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import { fetchYoutubeVideoApiData } from "../../content/content-youtube-video/fetch-youtube-video-api-data.js";
import DBSqlYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import {
  TYouTubeTranscriptStandardFormat,
  TPineconeVectorMetadataForContent,
  TSqlYoutubeVideoProcessingLog,
  EProcessingStatusType,
  ERequestCreateContentType,
} from "aiqna_common_v1";
import { saveYouTubeTranscriptsToDb } from "../../content/content-youtube-video/save-youtube-transcripts-to-db.js";
import DBSqlYoutubeVideoTranscript from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video-transcript.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "../../content/content-youtube-video/convert-youtube-transcript-segments-to-standard.js";
import { saveYouTubeTranscriptsToPineconeWithProviders } from "../../content/content-youtube-video/save-youtube-transcripts-to-pinecone.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { handleProcessingError } from "../../content/content-common/handle-processing-error.js";

/**
 * processCreateYouTubeVideo
 * YouTube 비디오 데이터 처리 (API 데이터 + 자막 → Pinecone 저장)
 * 
 * @param videoId - YouTube 비디오 ID (필수)
 * @returns 처리 결과
 */
export async function processCreateYouTubeVideo(
  videoId: string,
): Promise<{ success: boolean; videoId: string }> {
  try {
    console.log(`\n🚀 Starting YouTube video processing: ${videoId}`);
    
    const log = await getProcessingLogYouTubeVideo(videoId);

    // 1. API 데이터 처리 & Transcripts 처리 (병렬)
    const [videoData, transcripts] = await Promise.all([
      processYouTubeVideoApiData(videoId, log),
      processYouTubeVideoTranscripts(videoId, log),
    ]);

    // 2. Pinecone 저장
    await processYouTubeVideoToPinecone(
      videoId,
      videoData,
      transcripts,
      log,
    );

    console.log(`✅ YouTube video processing completed: ${videoId}\n`);
    return { success: true, videoId };
  } catch (error) {
    console.error(`❌ YouTube video processing failed: ${videoId}`, error);
    
    await handleProcessingError(
      ERequestCreateContentType.YoutubeVideo,
      videoId,
      error,
      0,
    );
    
    throw error;
  }
}

/**
 * Get Processing Log
 */
async function getProcessingLogYouTubeVideo(
  videoId: string
): Promise<TSqlYoutubeVideoProcessingLog | undefined> {
  const result = await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
  return result.data?.[0];
}

/**
 * 1. YouTube API 데이터 처리
 * YouTube API에서 비디오 메타데이터 가져오기 및 DB 저장
 */
async function processYouTubeVideoApiData(
  videoId: string,
  log?: TSqlYoutubeVideoProcessingLog,
): Promise<youtube_v3.Schema$Video> {
  // 이미 처리된 경우 DB에서 조회
  if (log?.is_api_data_fetched) {
    console.log("✅ API data already fetched, loading from DB...");
    const existing = await DBSqlYoutubeVideo.selectByVideoId(videoId);
    if (existing.data?.[0]) {
      console.log("✅ API data loaded from DB");
      return existing.data[0];
    }
  }

  // API 데이터가 없으면 새로 가져오기
  console.log("📥 Fetching YouTube API data...");

  return await withRetry(
    async () => {
      const data = await fetchYoutubeVideoApiData(videoId);
      
      console.log("💾 Saving API data to DB...");
      await DBSqlYoutubeVideo.upsert(data);
      
      await DBSqlProcessingLogYoutubeVideo.upsert({
        video_id: videoId,
        processing_status: EProcessingStatusType.processing,
        is_api_data_fetched: true,
      });

      console.log("✅ YouTube API data saved");
      return data;
    },
    {
      maxRetries: 3,
      baseDelay: 2000,
      operationName: "Fetch YouTube API data",
    }
  );
}

/**
 * 2. 트랜스크립트 처리
 * YouTube 자막 가져오기 및 DB 저장
 */
async function processYouTubeVideoTranscripts(
  videoId: string,
  log?: TSqlYoutubeVideoProcessingLog,
): Promise<TYouTubeTranscriptStandardFormat[]> {
  // 이미 처리된 경우 DB에서 조회
  if (log?.is_transcript_fetched) {
    console.log("✅ Transcripts already fetched, loading from DB...");
    const transcripts = await loadExistingTranscripts(videoId);
    console.log(`✅ Loaded ${transcripts.length} transcripts from DB`);
    return transcripts;
  }

  // 트랜스크립트가 없으면 새로 가져오기
  console.log("📥 Fetching YouTube transcripts...");

  return await withRetry(
    async () => {
      const transcripts = await saveYouTubeTranscriptsToDb(
        videoId,
        ["en", "ko"],
        './data/transcripts', // ✅ 로컬 캐시 경로 명시
      );
      
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
        is_transcript_fetched: true,
        is_transcript_exist: transcripts.length > 0, // 👈 추가
      });

      console.log(`✅ Saved ${transcripts.length} transcripts`);
      return transcripts;
    },
    {
      maxRetries: 3,
      baseDelay: 3000, // 자막은 더 보수적으로
      operationName: "Fetch YouTube transcripts",
    }
  );
}

/**
 * 3. Pinecone 처리
 * 비디오 메타데이터와 자막을 벡터화하여 Pinecone에 저장
 */
async function processYouTubeVideoToPinecone(
  videoId: string,
  videoData: youtube_v3.Schema$Video,
  transcripts: TYouTubeTranscriptStandardFormat[],
  log?: TSqlYoutubeVideoProcessingLog,
): Promise<void> {
  // 이미 처리되었거나 자막이 없으면 스킵
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  if (transcripts.length === 0) {
    console.warn("⚠️ No transcripts available, skipping Pinecone processing");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = convertYouTubeApiDataToPineconeVideoMetadata(videoData);
      
      await saveYouTubeTranscriptsToPineconeWithProviders(
        transcripts,
        metadata,
      );
      
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
        is_pinecone_processed: true,
        processing_status: EProcessingStatusType.completed, // ✅ enum 사용
      });

      console.log("✅ Pinecone processing completed");
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Pinecone processing",
    }
  );
}

/**
 * Load Existing Transcripts from DB
 */
async function loadExistingTranscripts(
  videoId: string,
): Promise<TYouTubeTranscriptStandardFormat[]> {
  const existingTranscripts =
    await DBSqlYoutubeVideoTranscript.selectByVideoId(videoId);

  if (!existingTranscripts.data?.length) {
    console.warn(`⚠️ No transcripts found in DB for video ${videoId}`);
    return [];
  }

  const transcripts =
    existingTranscripts.data
      .map((t) => {
        if (!t.segments_json) {
          console.warn(`⚠️ No segments_json for ${t.language}`);
          return null;
        }

        // 타입 체크 후 처리
        let parsedSegments;

        if (typeof t.segments_json === "string") {
          try {
            parsedSegments = JSON.parse(t.segments_json);
          } catch (error) {
            console.error(
              `❌ Failed to parse segments_json for ${t.language}:`,
              error,
            );
            return null;
          }
        } else {
          parsedSegments = t.segments_json;
        }

        const segments =
          convertYouTubeTranscriptSegmentsToStandard(parsedSegments);

        return {
          videoId,
          language: t.language,
          segments,
        };
      })
      .filter((t): t is TYouTubeTranscriptStandardFormat => t !== null);

  return transcripts;
}

/**
 * Convert YouTube API Data to Pinecone Metadata
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