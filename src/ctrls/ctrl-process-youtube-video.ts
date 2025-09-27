import { Request, Response } from "express";
import { fetchYoutubeVideoTranscriptByLanguage } from "../youtube/fetch-youtube-video-transcript.js";
import { getClientIp } from "../utils/get-client-ip.js";
import { extractVideoId } from "../youtube/extract-video-id.js";
import DBSbYoutubeVideoProcessingLog from "../db-sb-ctrls/db-sb-youtube/db-sb-youtube-video-processing-log.js";
import { fetchYoutubeVideoApiData } from "../youtube/fetch-youtube-video-api-data.js";
import DBSbYoutubeVideo from "../db-sb-ctrls/db-sb-youtube/db-sb-youtube-video.js";
import DBSbYoutubeVideoTranscript, { transformTranscriptForDB } from "../db-sb-ctrls/db-sb-youtube/db-sb-youtube-video-transcript.js";
import { TPineconeTranscriptData } from "aiqna_common_v1";
import { convertSegmentsToPineconeFormat } from "../utils/convert-segment-pincone.js";
import { EmbeddingProviderFactory } from "../utils/embedding/embedding-provider-factory.js";
import { processWithDifferentProviders } from "../db-pinecone-ctrls/db-pc-save.js";

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
      const log = youtubeVideoProcessingLog.data[0];
      
      // 1. API 데이터 가져오기
      let youtubeVideoApiData;
      if (!log.is_api_data_fetched) {
        youtubeVideoApiData = await fetchYoutubeVideoApiData(videoId);
        console.log("youtubeVideoApiData =====>", youtubeVideoApiData);
        await DBSbYoutubeVideo.upsert(youtubeVideoApiData);
        
        // 상태 업데이트
        await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
          video_id: videoId,
          is_api_data_fetched: true
        });
      } else {
        // 이미 저장된 데이터 가져오기
        const existingVideo = await DBSbYoutubeVideo.selectByVideoId(videoId);
        youtubeVideoApiData = existingVideo.data?.[0];
      }

      // 2. 트랜스크립트 가져오기
      let transcripts: TPineconeTranscriptData[] = [];
      if (!log.is_transcript_fetched) {
        transcripts = await saveMultipleLanguageTranscripts(videoId, ['en', 'ko']);
        
        // 상태 업데이트
        await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
          video_id: videoId,
          is_transcript_fetched: true
        });
      } else {
        // 이미 저장된 트랜스크립트 가져오기
        const existingTranscripts = await DBSbYoutubeVideoTranscript.selectByVideoId(videoId);
        transcripts = existingTranscripts.data?.map(t => ({
          videoId,
          language: t.language,
          segments: convertSegmentsToPineconeFormat(t.segments_json)
        })) || [];
      }

      // 3. Pinecone 저장
      if (!log.is_pinecone_processed && youtubeVideoApiData && transcripts.length > 0) {
        const provider = EmbeddingProviderFactory.createProvider('openai');
        await processWithDifferentProviders(videoId, transcripts, youtubeVideoApiData);
        
        // 상태 업데이트
        await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
          video_id: videoId,
          is_pinecone_processed: true
        });
      }
      
    } else {
      // 새로 생성
      const youtubeVideoApiData = await fetchYoutubeVideoApiData(videoId);
      console.log("youtubeVideoApiData =====>", youtubeVideoApiData);
      await DBSbYoutubeVideo.upsert(youtubeVideoApiData);
      
      // 처리 로그 생성
      await DBSbYoutubeVideoProcessingLog.insert({
        video_id: videoId,
        processing_status: 'processing',
        is_api_data_fetched: true,
        is_transcript_fetched: false,
        is_pinecone_processed: false
      });
  
      // 트랜스크립트 가져오기
      const transcripts = await saveMultipleLanguageTranscripts(videoId, ['en', 'ko']);
      
      // 상태 업데이트
      await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
        video_id: videoId,
        processing_status: 'processing',
        is_transcript_fetched: true
      });
      
      // Pinecone 저장
      const provider = EmbeddingProviderFactory.createProvider('openai');
      await saveToPineconeWithProvider(
        transcripts,
        youtubeVideoApiData,
        provider,
        'text-embedding-3-small',
        'youtube-transcripts'
      );
      
      // 상태 업데이트
      await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
        video_id: videoId,
        processing_status: 'processing',
        is_pinecone_processed: true
      });
    }
    
    return { success: true, videoId };
    
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Database query error: ${err.message}`);
  }
}


/**
 * 여러 언어의 트랜스크립트를 저장하고 결과 반환
 */
export async function saveMultipleLanguageTranscripts(
  videoId: string,
  languages: string[] = ['ko', 'en']
): Promise<TPineconeTranscriptData[]> {
  const savedTranscripts: TPineconeTranscriptData[] = [];
  
  for (const lang of languages) {
    try {
      const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(videoId, lang);
      
      const transcriptData = transformTranscriptForDB(
        videoId, 
        transcriptResult,
        transcriptResult.language
      );
      
      await DBSbYoutubeVideoTranscript.insert(transcriptData);
      
      // segments_json을 Pinecone 형식으로 변환
      const pineconeSegments = convertSegmentsToPineconeFormat(transcriptData.segments_json);
      
      // 저장된 트랜스크립트 데이터 반환용으로 추가
      savedTranscripts.push({
        videoId,
        language: transcriptData.language || transcriptResult.language,
        segments: pineconeSegments
      });
      
      console.log(`✓ ${transcriptResult.language} 트랜스크립트 저장 완료`);
      
    } catch (error) {
      const err = error as Error;
      console.log(`✗ ${lang} 트랜스크립트 없음: ${err.message}`);
      continue;
    }
  }
  
  if (savedTranscripts.length === 0) {
    throw new Error('No transcripts available for any language');
  }
  
  console.log(`총 ${savedTranscripts.length}개 언어 저장 완료`);
  return savedTranscripts;
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



