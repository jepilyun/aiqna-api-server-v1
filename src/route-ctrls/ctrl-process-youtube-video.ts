import { Request, Response } from "express";
import { fetchYoutubeVideoTranscriptByLanguage } from "../utils/utils-youtube/fetch-youtube-video-transcript.js";
import { extractYouTubeVideoId } from "../utils/utils-youtube/extract-youtube-video-id.js";
import DBSbYoutubeVideoProcessingLog from "../db-ctrls/db-sb-ctrls/db-sb-youtube-video-processing-log.js";
import { fetchYoutubeVideoApiData } from "../utils/utils-youtube/fetch-youtube-video-api-data.js";
import DBSbYoutubeVideo from "../db-ctrls/db-sb-ctrls/db-sb-youtube-video.js";
import DBSbYoutubeVideoTranscript from "../db-ctrls/db-sb-ctrls/db-sb-youtube-video-transcript.js";
import {
  TPineconeFullYouTubeTranscript,
  TPineconeYouTubeTranscriptSegment,
  TPineconeYouTubeVideoMetadata,
  TSqlYoutubeVideoTranscriptInsert,
  TYouTubeTranscriptSegment,
} from "aiqna_common_v1";
import { processWithDifferentProviders } from "../db-ctrls/db-pc-ctrls/db-pc-save.js";
import { youtube_v3 } from "googleapis";
import { sleep } from "../utils/sleep.js";
import { isRetryableError } from "../utils/is-retryable-error.js";
import { extractTextFromYouTubeTranscriptSegment } from "../utils/utils-youtube/extract-transcript-segment.js";
import { VideoMetadataExtractionService } from "../utils/utils-ai/extract-metadata.js";
import { TExtractedVideoMetadata } from "../types/shared.js";


/**
 * YouTube Video Process Controller
 * @param req
 * @param res
 * @returns
 */
export async function ctrlProcessYoutubeVideo(req: Request, res: Response) {
  try {
    const videoUrlOrId = req.body.id;

    if (!videoUrlOrId) {
      return res.status(400).json({
        error: "Video ID or URL is required",
      });
    }

    const videoId = extractYouTubeVideoId(videoUrlOrId as string);

    if (!videoId) {
      return res.status(400).json({
        error: "Invalid YouTube Video ID or URL format",
      });
    }

    // 이미 처리 중인지 확인
    const existingLog =
      await DBSbYoutubeVideoProcessingLog.selectByVideoId(videoId);
    const isProcessing =
      existingLog.data?.[0]?.processing_status === "processing";

    if (isProcessing) {
      return res.json({
        success: true,
        videoId,
        message: "Already processing",
        statusUrl: `/api/main/video-status/${videoId}`,
      });
    }

    // 즉시 응답
    res.json({
      success: true,
      videoId,
      message: "Processing started",
      statusUrl: `/api/main/video-status/${videoId}`,
    });

    // 백그라운드 처리
    processYoutubeVideoData(videoId).catch((err) => {
      console.error(`Background processing failed for ${videoId}:`, err);
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Initial validation failed:", err);

    return res.status(500).json({
      error: "Failed to initiate video processing",
      message: err.message,
    });
  }
}

/**
 * processYoutubeVideoData
 * YouTube 비디오 데이터 처리
 * @param videoId
 * @returns
 */
export async function processYoutubeVideoData(videoId: string, retryCount = 0) {
  const MAX_RETRIES = 3;
  const metadataExtractor = new VideoMetadataExtractionService();


  try {
    const youtubeVideoProcessingLog =
      await DBSbYoutubeVideoProcessingLog.selectByVideoId(videoId);
    const log = youtubeVideoProcessingLog.data?.[0];

    // 1. API 데이터 처리 (재시도 가능)
    let youtubeVideoApiData: youtube_v3.Schema$Video;

    if (!log?.is_api_data_fetched) {
      try {
        youtubeVideoApiData = await fetchYoutubeVideoApiData(videoId);
        await DBSbYoutubeVideo.upsert(youtubeVideoApiData);

        if (!log) {
          await DBSbYoutubeVideoProcessingLog.upsert(videoId, {
            video_id: videoId,
            processing_status: "processing",
            is_api_data_fetched: true,
            is_transcript_fetched: false,
            is_pinecone_processed: false,
          });
        } else {
          await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
            video_id: videoId,
            is_api_data_fetched: true,
          });
        }
      } catch (apiError) {
        console.error("API fetch failed:", apiError);

        // 재시도 가능한 에러인지 확인
        if (retryCount < MAX_RETRIES && isRetryableError(apiError)) {
          console.log(
            `Retrying API fetch (${retryCount + 1}/${MAX_RETRIES})...`,
          );

          await sleep(1000 * (retryCount + 1)); // 지수 백오프
          return processYoutubeVideoData(videoId, retryCount + 1);
        }

        // 재시도 불가능하거나 한도 초과
        throw apiError; 
      }
    } else {
      const existingVideo = await DBSbYoutubeVideo.selectByVideoId(videoId);
      youtubeVideoApiData = existingVideo.data?.[0];
    }

    if (!youtubeVideoApiData) {
      throw new Error("Failed to fetch video data");
    }

    // 2. 트랜스크립트 처리 (재시도 가능)
    let transcripts: TPineconeFullYouTubeTranscript[] = [];

    if (!log?.is_transcript_fetched) {
      try {
        transcripts = await saveMultipleLanguageTranscripts(videoId, [
          "en",
          "ko",
        ]);

        await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
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
          return processYoutubeVideoData(videoId, retryCount + 1);
        }
        throw transcriptError;
      }
    } else {
      const existingTranscripts = await DBSbYoutubeVideoTranscript.selectByVideoId(videoId);

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

            const segments = convertYouTubeTranscriptSegmentsToPineconeFormat(parsedSegments);

            return {
              videoId,
              language: t.language,
              segments,
            };
          })
          .filter((t): t is TPineconeFullYouTubeTranscript => t !== null) || [];
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
          const metadata = await metadataExtractor.extractMetadata(
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

        await processWithDifferentProviders(transcripts, videoMetadata, extractedMetadata);

        await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
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
          return processYoutubeVideoData(videoId, retryCount + 1);
        }
        throw pineconeError;
      }
    }

    return { success: true, videoId };
  } catch (error: unknown) {
    const err = error as Error;

    await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
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

// 유틸리티 함수 추가
function convertYouTubeApiDataToPineconeVideoMetadata(
  videoData: youtube_v3.Schema$Video,
): TPineconeYouTubeVideoMetadata {
  return {
    video_id: videoData.id || "",
    title: videoData.snippet?.title || "",
    channel_title: videoData.snippet?.channelTitle || "",
    channel_id: videoData.snippet?.channelId || "",
    published_at: videoData.snippet?.publishedAt || "",
    thumbnail_url: videoData.snippet?.thumbnails?.high?.url || "",
    duration: videoData.contentDetails?.duration || "",
    view_count: parseInt(videoData.statistics?.viewCount || "0"),
    like_count: parseInt(videoData.statistics?.likeCount || "0"),
  };
}

/**
 * 여러 언어의 트랜스크립트를 저장하고 결과 반환
 * @param videoId
 * @param languages
 * @returns
 */
async function saveMultipleLanguageTranscripts(
  videoId: string,
  languages: string[] = ["ko", "en"],
): Promise<TPineconeFullYouTubeTranscript[]> {
  const savedTranscripts: TPineconeFullYouTubeTranscript[] = [];

  for (const lang of languages) {
    try {
      const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(
        videoId,
        lang,
      );

      // DB insert 형식으로 변환
      const transcriptData = transformYouTubeTranscriptToSqlDbInsertFormat(
        videoId,
        transcriptResult,
        transcriptResult.language,
      );

      await DBSbYoutubeVideoTranscript.insert(transcriptData);

      // segments_json을 Pinecone 형식으로 변환
      const pineconeSegments = convertYouTubeTranscriptSegmentsToPineconeFormat(
        transcriptData.segments_json,
      );

      // 저장된 트랜스크립트 데이터 반환용으로 추가
      savedTranscripts.push({
        videoId,
        language: transcriptData.language || transcriptResult.language,
        segments: pineconeSegments,
      });

      console.log(`✓ ${transcriptResult.language} 트랜스크립트 저장 완료`);
    } catch (error) {
      const err = error as Error;
      console.log(`✗ ${lang} 트랜스크립트 없음: ${err.message}`);
      continue;
    }
  }

  if (savedTranscripts.length === 0) {
    throw new Error("No transcripts available for any language");
  }

  console.log(`총 ${savedTranscripts.length}개 언어 저장 완료`);
  return savedTranscripts;
}

/**
 * fetchYoutubeVideoTranscript 결과를 DB insert 형식으로 변환
 *
 * @param videoId - YouTube 비디오 ID
 * @param transcriptResult - fetchYoutubeVideoTranscript 반환값
 * @param language - 트랜스크립트 언어 (기본값: 'ko')
 * @returns DB insert용 데이터
 */
export function transformYouTubeTranscriptToSqlDbInsertFormat(
  videoId: string,
  transcriptResult: {
    videoTitle: string;
    transcript: TYouTubeTranscriptSegment[];
  },
  language: string = "ko",
): TSqlYoutubeVideoTranscriptInsert {
  const { transcript } = transcriptResult;

  // 전체 텍스트 추출 (검색용)
  const fullText = transcript
    .map((seg: TYouTubeTranscriptSegment) => extractTextFromYouTubeTranscriptSegment(seg))
    .filter((text) => text.trim())
    .join(" ");

  // 총 길이 계산 (마지막 세그먼트의 end_ms)
  const totalDuration =
    transcript.length > 0
      ? Math.max(
          ...transcript.map(
            (seg) =>
              parseFloat(seg.transcript_segment_renderer.end_ms || "0") / 1000,
          ),
        )
      : 0;

  return {
    video_id: videoId,
    language,
    total_duration: totalDuration,
    segment_count: transcript.length,
    segments_json: transcript, // JSONB 컬럼에 그대로 저장
    full_text: fullText,
  };
}

/**
 * convertSegmentsToPineconeFormat
 * TYouTubeTranscriptSegment[]을 TPineconeYouTubeTranscriptSegment[]으로 변환
 * @param segments TYouTubeTranscriptSegment[]
 * @returns 
 */
export function convertYouTubeTranscriptSegmentsToPineconeFormat(
  segments: TYouTubeTranscriptSegment[],
): TPineconeYouTubeTranscriptSegment[] {
  return segments.map((seg: TYouTubeTranscriptSegment) => {
    return {
      text: seg.transcript_segment_renderer.snippet?.text || "", // text 필드 확인
      start: seg.transcript_segment_renderer.start_ms
        ? parseInt(seg.transcript_segment_renderer.start_ms) / 1000
        : 0,
      duration: seg.transcript_segment_renderer.end_ms
        ? (parseInt(seg.transcript_segment_renderer.end_ms) -
            parseInt(seg.transcript_segment_renderer.start_ms || "0")) /
          1000
        : 0,
    };
  });
}
