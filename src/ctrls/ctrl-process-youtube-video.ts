import { Request, Response } from "express";
// import supabase from "../config/supabase.js";
import { fetchYoutubeVideoTranscriptByLanguage } from "../youtube/fetch-youtube-video-transcript.js";
// import { saveToPinecone } from "../pinecone/save-to-pinecone";
import { getClientIp } from "../utils/get-client-ip.js";
import { extractVideoId } from "../youtube/extract-video-id.js";
import DBSbYoutubeVideoProcessingLog from "../db-sb-ctrls/db-sb-youtube/db-sb-youtube-video-processing-log.js";
import { fetchYoutubeVideoApiData } from "../youtube/fetch-youtube-video-api-data.js";
import DBSbYoutubeVideo from "../db-sb-ctrls/db-sb-youtube/db-sb-youtube-video.js";
import DBSbYoutubeVideoTranscript, { transformTranscriptForDB } from "../db-sb-ctrls/db-sb-youtube/db-sb-youtube-video-transcript.js";

/**
 * processYoutubeVideoData
 * YouTube 비디오 데이터 처리
 * @param videoId 
 * @returns 
 */
export async function processYoutubeVideoData(videoId: string) {
  try {
    const youtubeVideoProcessingLog = await DBSbYoutubeVideoProcessingLog.selectByVideoId(videoId);
    console.log("youtubeVideoProcessingLog =====>", youtubeVideoProcessingLog);

    if (youtubeVideoProcessingLog.data && youtubeVideoProcessingLog.data.length > 0) {
      if (!youtubeVideoProcessingLog.data[0].is_api_data_fetched) {
        // fetch YouTube API data
        const youtubeVideoApiData = await fetchYoutubeVideoApiData(videoId);
        console.log("youtubeVideoApiData =====>", youtubeVideoApiData);
        await DBSbYoutubeVideo.upsert(youtubeVideoApiData);
      }

      if (!youtubeVideoProcessingLog.data[0].is_transcript_fetched) {
        // 여러 언어 시도 (에러 핸들링 포함)
        await saveMultipleLanguageTranscripts(videoId, ['en', 'ko']);
      }

      if (!youtubeVideoProcessingLog.data[0].is_pinecone_processed) {
        // save to Pinecone
      }
    } else {
      // 새로 생성
      const youtubeVideoApiData = await fetchYoutubeVideoApiData(videoId);
      console.log("youtubeVideoApiData =====>", youtubeVideoApiData);
      await DBSbYoutubeVideo.upsert(youtubeVideoApiData);
  
      // 트랜스크립트 가져오기
      // 여러 언어 시도 (에러 핸들링 포함)
      await saveMultipleLanguageTranscripts(videoId, ['en', 'ko']);
      
      // save to Pinecone
    }
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Database query error: ${err.message}`);
  }

  // let transcriptData: {
  //   videoTitle: string;
  //   transcript: TranscriptSegment[];
  // } | null = null;
  // let videoMetadata: TYouTubeVideoMetadata | null = null;

  // 5. is_pinecone_saved_index_01이 false이면 Pinecone에 저장
  // if (!videoRecord.is_pinecone_saved_index_01 && transcriptData) {
  //   console.log(`Saving to Pinecone for video ${videoId}...`);
  //   await saveToPinecone(
  //     videoId,
  //     transcriptData.transcript,
  //     transcriptData.videoTitle,
  //   );

  //   // Pinecone 저장 완료 표시
  //   const { error: updateError } = await supabase
  //     .from("videos")
  //     .update({
  //       is_pinecone_saved_index_01: true,
  //       updated_at: new Date().toISOString(),
  //     })
  //     .eq("video_id", videoId);

  //   if (updateError) {
  //     throw new Error(
  //       `Failed to update Pinecone status: ${updateError.message}`,
  //     );
  //   }

  //   console.log(`Pinecone processing completed for video ${videoId}`);
  // }

  // return {
  //   videoTitle:
  //     transcriptData?.videoTitle || videoRecord.video_title || "Unknown Title",
  //   transcript: transcriptData?.transcript || [],
  //   metadata: videoMetadata || videoRecord.video_metadata || {},
  //   processingStatus: {
  //     transcriptSaved: true,
  //     metadataFetched: true,
  //     pineconeProcessed: true,
  //   },
  // };
}


/**
 * 여러 언어의 트랜스크립트를 저장 (에러 핸들링 포함)
 */
async function saveMultipleLanguageTranscripts(
  videoId: string,
  languages: string[] = ['ko', 'en']
): Promise<void> {
  const savedLanguages: string[] = [];
  
  for (const lang of languages) {
    try {
      const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(videoId, lang);
      
      const transcriptData = transformTranscriptForDB(
        videoId, 
        transcriptResult,
        transcriptResult.language // 실제 반환된 언어 사용
      );
      
      await DBSbYoutubeVideoTranscript.insert(transcriptData);
      savedLanguages.push(transcriptResult.language);
      
      console.log(`✓ ${transcriptResult.language} 트랜스크립트 저장 완료`);
      
    } catch (error) {
      const err = error as Error;
      console.log(`✗ ${lang} 트랜스크립트 없음: ${err.message}`);
      // 에러를 throw하지 않고 계속 진행
      continue;
    }
  }
  
  // 하나도 저장 못했으면 에러
  if (savedLanguages.length === 0) {
    throw new Error('No transcripts available for any language');
  }
  
  console.log(`총 ${savedLanguages.length}개 언어 저장 완료: ${savedLanguages.join(', ')}`);
}

/**
 * YouTube Video Process Controller
 * @param req
 * @param res
 * @returns
 */
export async function ctrlProcessYoutubeVideo(req: Request, res: Response) {
  try {
    // Rate limiting 로직 (기존과 동일)
    const ipAddress = getClientIp(req);
    console.log("ipAddress =====>", ipAddress);

    // Get video ID from query parameters
    const videoUrlOrId = req.query.id;

    if (!videoUrlOrId) {
      return res.status(400).json({
        error: "Video ID or URL is required (query param: 'id')",
      });
    }

    // Extract video ID using the helper function
    const videoId = extractVideoId(videoUrlOrId as string);
    console.log("videoId =====>", videoId);

    if (!videoId) {
      return res.status(400).json({
        error: "Invalid YouTube Video ID or URL format",
      });
    }

    // 메인 처리 로직 실행
    const result = await processYoutubeVideoData(videoId);

    // 성공 응답 반환
    return res.json({
      videoId,
      // ...result,
    });
  } catch (error: unknown) {
    // Error handling
    const err = error as Error;
    console.error(
      `Error processing video ${req.query.id}:`,
      err.message,
      err.stack,
    );

    let errorMessage = "Failed to process video data.";
    let statusCode = 500;

    // Handle specific error types
    if (err instanceof SyntaxError && err.message.includes("JSON")) {
      errorMessage =
        "Failed to process data from YouTube. The API response may be malformed or incomplete.";
    } else if (
      err.message.includes("private") ||
      err.message.includes("unavailable") ||
      err.message.includes("premiere") ||
      err.message.includes("live")
    ) {
      errorMessage =
        "Video is private, unavailable, a live stream, or a premiere without a processed transcript.";
      statusCode = 403;
    } else if (err.message.includes("region-locked")) {
      errorMessage = "The video is region-locked and unavailable.";
      statusCode = 451;
    } else if (
      err.message.includes("Transcripts are not available for this video")
    ) {
      errorMessage = "Transcripts are not available for this video.";
      statusCode = 404;
    } else if (err.message.includes("Database")) {
      errorMessage = "Database operation failed.";
      statusCode = 500;
    } else if (err.message.includes("Pinecone")) {
      errorMessage = "Vector database operation failed.";
      statusCode = 500;
    }

    return res.status(statusCode).json({
      error: errorMessage,
      videoId: req.query.id,
    });
  }
}



