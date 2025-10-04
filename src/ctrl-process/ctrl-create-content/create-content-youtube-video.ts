import { youtube_v3 } from "googleapis";
import DBSqlProcessingLogYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-youtube-video.js";
import { YouTubeVideoMetadataExtractor } from "./youtube-video/youtube-video-metadata-extractor.js";
import { fetchYoutubeVideoApiData } from "./youtube-video/fetch-youtube-video-api-data.js";
import DBSqlYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-youtube-video.js";
import { EProcessingStatusType, MAX_RETRIES } from "../../consts/const.js";
import { isRetryableError } from "../../utils/is-retryable-error.js";
import { sleep } from "../../utils/sleep.js";
import { TYouTubeTranscriptStandardFormat, TPineconeVectorMetadataForContent } from "aiqna_common_v1";
import { saveYouTubeTranscriptsToDb } from "./youtube-video/save-youtube-transcripts-to-db.js";
import DBSqlYoutubeVideoTranscript from "../../ctrl-db/ctrl-db-sql/db-sql-youtube-video-transcript.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "./youtube-video/convert-youtube-transcript-segments-to-standard.js";
import { TExtractedVideoMetadata } from "../../types/shared.js";
import { saveYouTubeTranscriptsToPineconeWithProviders } from "./youtube-video/save-youtube-transcripts-to-pinecone.js";


/**
 * createContentYouTubeVideo
 * YouTube 비디오 데이터 처리
 * @param videoId
 * @returns
 */
export async function createContentYouTubeVideo(videoId: string, retryCount = 0) {
  const youtubeVideoMetadataExtractor = new YouTubeVideoMetadataExtractor();

  try {
    const youtubeVideoProcessingLog = await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
    const log = youtubeVideoProcessingLog.data?.[0];

    // 1. API 데이터 처리 (재시도 가능)
    let youtubeVideoApiData: youtube_v3.Schema$Video;

    if (!log?.is_api_data_fetched) {
      try {
        youtubeVideoApiData = await fetchYoutubeVideoApiData(videoId);
        await DBSqlYoutubeVideo.upsert(youtubeVideoApiData);

        // upsert 사용 - 존재하면 업데이트, 없으면 삽입
        await DBSqlProcessingLogYoutubeVideo.upsert({
          video_id: videoId,
          processing_status: EProcessingStatusType.processing,
          is_api_data_fetched: true,
        });
      } catch (apiError) {
        console.error("API fetch failed:", apiError);

        // 재시도 가능한 에러인지 확인
        if (retryCount < MAX_RETRIES && isRetryableError(apiError)) {
          console.log(
            `Retrying API fetch (${retryCount + 1}/${MAX_RETRIES})...`,
          );

          await sleep(1000 * (retryCount + 1)); // 지수 백오프
          return createContentYouTubeVideo(videoId, retryCount + 1);
        }

        // 재시도 불가능하거나 한도 초과
        throw apiError; 
      }
    } else {
      const existingVideo = await DBSqlYoutubeVideo.selectByVideoId(videoId);
      youtubeVideoApiData = existingVideo.data?.[0];
    }

    if (!youtubeVideoApiData) {
      throw new Error("Failed to fetch YouTube Video API dat.");
    }

    // 2. 트랜스크립트 처리 (재시도 가능)
    let transcripts: TYouTubeTranscriptStandardFormat[] = [];

    if (!log?.is_transcript_fetched) {
      try {
        transcripts = await saveYouTubeTranscriptsToDb(videoId, [
          "en",
          "ko",
        ]);

        await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
          video_id: videoId,
          is_transcript_fetched: true,
        });
      } catch (transcriptError) {
        console.error("Transcript fetch failed:", transcriptError);

        if (retryCount < MAX_RETRIES && isRetryableError(transcriptError)) {
          console.log(
            `Retrying transcript fetch (${retryCount + 1}/${MAX_RETRIES})...`,
          );
          await sleep(1000 * (retryCount + 1));
          return createContentYouTubeVideo(videoId, retryCount + 1);
        }
        throw transcriptError;
      }
    } else {
      const existingTranscripts = await DBSqlYoutubeVideoTranscript.selectByVideoId(videoId);

      transcripts =
        existingTranscripts.data
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
                console.error(
                  `Failed to parse segments_json for ${t.language}:`,
                  error,
                );
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
    }

    // 3. 메타데이터 추출 (새로 추가)
    const extractedMetadata: Map<string, TExtractedVideoMetadata> = new Map();

    if (transcripts.length > 0) {
      try {
        console.log(`Starting metadata extraction for ${videoId}...`);

        for (const transcript of transcripts) {
          // 전체 텍스트 생성
          const fullText = transcript.segments
            .map(seg => seg.text)
            .join(' ');

          // LLM으로 메타데이터 추출
          const metadata = await youtubeVideoMetadataExtractor.extractMetadataFromFullTranscript(
            videoId,
            youtubeVideoApiData.snippet?.title || '',
            fullText,
            transcript.language
          );

          extractedMetadata.set(transcript.language, metadata);

          console.log(`✓ Metadata extracted for ${transcript.language}:`, {
            categories: metadata.categories.length,
            keywords: metadata.keywords.length,
            locations: metadata.locations.length,
            names: metadata.names.length,
            score: metadata.confidence_score
          });

          // Rate limit 방지 (Groq 무료 티어: 30 requests/min)
          await sleep(2000);
        }
      } catch (metadataError) {
        console.error("Metadata extraction failed:", metadataError);
        
        // 메타데이터 추출 실패는 전체 프로세스를 중단하지 않음
        console.warn("Continuing without metadata...");
      }
    }

    // 4. Pinecone 처리 (재시도 가능)
    if (!log?.is_pinecone_processed && transcripts.length > 0) {
      try {
        const videoMetadata = convertYouTubeApiDataToPineconeVideoMetadata(
          youtubeVideoApiData,
        );

        await saveYouTubeTranscriptsToPineconeWithProviders(transcripts, videoMetadata);

        await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
          video_id: videoId,
          is_pinecone_processed: true,
          processing_status: "completed",
        });
      } catch (pineconeError) {
        console.error("Pinecone processing failed:", pineconeError);

        if (retryCount < MAX_RETRIES && isRetryableError(pineconeError)) {
          console.log(
            `Retrying Pinecone processing (${retryCount + 1}/${MAX_RETRIES})...`,
          );
          await sleep(1000 * (retryCount + 1));
          return createContentYouTubeVideo(videoId, retryCount + 1);
        }
        throw pineconeError;
      }
    }

    return { success: true, videoId };
  } catch (error: unknown) {
    const err = error as Error;

    await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
      video_id: videoId,
      processing_status: "failed",
      error_message: err.message,
      retry_count: retryCount,
    });

    throw new Error(
      `Processing failed after ${retryCount} retries: ${err.message}`,
    );
  }
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




