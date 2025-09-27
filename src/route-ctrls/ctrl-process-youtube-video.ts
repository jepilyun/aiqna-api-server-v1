import { Request, Response } from "express";
import { fetchYoutubeVideoTranscriptByLanguage } from "../youtube/fetch-youtube-video-transcript.js";
import { extractVideoId } from "../youtube/extract-video-id.js";
import DBSbYoutubeVideoProcessingLog from "../db-ctrls/db-sb-ctrls/db-sb-youtube-video-processing-log.js";
import { fetchYoutubeVideoApiData } from "../youtube/fetch-youtube-video-api-data.js";
import DBSbYoutubeVideo from "../db-ctrls/db-sb-ctrls/db-sb-youtube-video.js";
import DBSbYoutubeVideoTranscript, { transformTranscriptForDB } from "../db-ctrls/db-sb-ctrls/db-sb-youtube-video-transcript.js";
import { TPineconeTranscriptData, TPineconeVideoMetadata } from "aiqna_common_v1";
import { convertSegmentsToPineconeFormat } from "../utils/convert-segment-pincone.js";
import { processWithDifferentProviders } from "../db-ctrls/db-pc-ctrls/db-pc-save.js";
import { youtube_v3 } from "googleapis";
import { sleep } from "../utils/sleep.js";

/**
 * processYoutubeVideoData
 * YouTube 비디오 데이터 처리
 * @param videoId 
 * @returns 
 */
export async function processYoutubeVideoData(videoId: string, retryCount = 0) {
  const MAX_RETRIES = 3;
  
  try {
    const youtubeVideoProcessingLog = await DBSbYoutubeVideoProcessingLog.selectByVideoId(videoId);
    const log = youtubeVideoProcessingLog.data?.[0];

    // 1. API 데이터 처리 (재시도 가능)
    let youtubeVideoApiData;
    if (!log?.is_api_data_fetched) {
      try {
        youtubeVideoApiData = await fetchYoutubeVideoApiData(videoId);
        await DBSbYoutubeVideo.upsert(youtubeVideoApiData);
        
        if (!log) {
          await DBSbYoutubeVideoProcessingLog.upsert(videoId, {
            video_id: videoId,
            processing_status: 'processing',
            is_api_data_fetched: true,
            is_transcript_fetched: false,
            is_pinecone_processed: false
          });
        } else {
          await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
            video_id: videoId,
            is_api_data_fetched: true
          });
        }
      } catch (apiError) {
        console.error('API fetch failed:', apiError);
        
        // 재시도 가능한 에러인지 확인
        if (retryCount < MAX_RETRIES && isRetryableError(apiError)) {
          console.log(`Retrying API fetch (${retryCount + 1}/${MAX_RETRIES})...`);
          await sleep(1000 * (retryCount + 1)); // 지수 백오프
          return processYoutubeVideoData(videoId, retryCount + 1);
        }
        throw apiError; // 재시도 불가능하거나 한도 초과
      }
    } else {
      const existingVideo = await DBSbYoutubeVideo.selectByVideoId(videoId);
      youtubeVideoApiData = existingVideo.data?.[0];
    }

    if (!youtubeVideoApiData) {
      throw new Error('Failed to fetch video data');
    }

    // 2. 트랜스크립트 처리 (재시도 가능)
    let transcripts: TPineconeTranscriptData[] = [];
    if (!log?.is_transcript_fetched) {
      try {
        transcripts = await saveMultipleLanguageTranscripts(videoId, ['en', 'ko']);
        
        await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
          video_id: videoId,
          is_transcript_fetched: true
        });
      } catch (transcriptError) {
        console.error('Transcript fetch failed:', transcriptError);
        
        if (retryCount < MAX_RETRIES && isRetryableError(transcriptError)) {
          console.log(`Retrying transcript fetch (${retryCount + 1}/${MAX_RETRIES})...`);
          await sleep(1000 * (retryCount + 1));
          return processYoutubeVideoData(videoId, retryCount + 1);
        }
        throw transcriptError;
      }
    } else {
      const existingTranscripts = await DBSbYoutubeVideoTranscript.selectByVideoId(videoId);
      // transcripts = existingTranscripts.data?.map(t => ({
      //   videoId,
      //   language: t.language,
      //   segments: t.segments_json 
      //     ? convertSegmentsToPineconeFormat(JSON.parse(t.segments_json))
      //     : []
      // })) || [];
      // transcripts = existingTranscripts.data?.map(t => {
      //   const segments = t.segments_json 
      //     ? convertSegmentsToPineconeFormat(JSON.parse(t.segments_json))
      //     : [];
        
      //   // ✅ 실제 구조 확인
      //   console.log('Raw segment from DB:', segments[0]);
        
      //   return {
      //     videoId,
      //     language: t.language,
      //     segments
      //   };
      // }).filter(s => s.segments.length > 0) || [];

      transcripts = existingTranscripts.data?.map(t => {
        if (!t.segments_json) {
          console.warn(`No segments_json for ${t.language}`);
          return null;
        }
        
        // 타입 체크 후 처리
        let parsedSegments;
        if (typeof t.segments_json === 'string') {
          try {
            parsedSegments = JSON.parse(t.segments_json);
          } catch (error) {
            console.error(`Failed to parse segments_json for ${t.language}:`, error);
            return null;
          }
        } else {
          parsedSegments = t.segments_json;
        }
        
        const segments = convertSegmentsToPineconeFormat(parsedSegments);
        
        return {
          videoId,
          language: t.language,
          segments
        };
      }).filter((t): t is TPineconeTranscriptData => t !== null) || [];
    }

    // 3. Pinecone 처리 (재시도 가능)
    if (!log?.is_pinecone_processed && transcripts.length > 0) {
      try {
        const videoMetadata = convertToVideoMetadata(videoId, youtubeVideoApiData);
        await processWithDifferentProviders(transcripts, videoMetadata);
        
        await DBSbYoutubeVideoProcessingLog.updateDetailByVideoId(videoId, {
          video_id: videoId,
          is_pinecone_processed: true,
          processing_status: 'completed'
        });
      } catch (pineconeError) {
        console.error('Pinecone processing failed:', pineconeError);
        
        if (retryCount < MAX_RETRIES && isRetryableError(pineconeError)) {
          console.log(`Retrying Pinecone processing (${retryCount + 1}/${MAX_RETRIES})...`);
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
      processing_status: 'failed',
      error_message: err.message,
      retry_count: retryCount
    });
    
    throw new Error(`Processing failed after ${retryCount} retries: ${err.message}`);
  }
}

// 재시도 가능한 에러인지 판단
function isRetryableError(error: unknown): boolean {
  const retryableMessages = [
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
    'rate limit',
    'temporarily unavailable'
  ];
  
  return retryableMessages.some(msg => 
    error instanceof Error && error.message?.toLowerCase().includes(msg.toLowerCase())
  );
}

// 유틸리티 함수 추가
function convertToVideoMetadata(
  videoId: string,
  videoData: youtube_v3.Schema$Video
): TPineconeVideoMetadata {
  return {
    video_id: videoData.id || '',
    title: videoData.snippet?.title || '',
    channel_title: videoData.snippet?.channelTitle || '',
    channel_id: videoData.snippet?.channelId || '',
    published_at: videoData.snippet?.publishedAt || '',
    thumbnail_url: videoData.snippet?.thumbnails?.high?.url || '',
    duration: videoData.contentDetails?.duration || '',
    view_count: parseInt(videoData.statistics?.viewCount || '0'),
    like_count: parseInt(videoData.statistics?.likeCount || '0')
  };
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
/**
 * YouTube Video Process Controller - 즉시 응답 + 백그라운드 처리
 */
export async function ctrlProcessYoutubeVideo(req: Request, res: Response) {
  try {
    // 입력 검증
    const videoUrlOrId = req.body.id;  // GET/POST 모두 지원
    
    if (!videoUrlOrId) {
      return res.status(400).json({
        error: "Video ID or URL is required",
      });
    }

    const videoId = extractVideoId(videoUrlOrId as string);
    console.log("videoId =====>", videoId);

    if (!videoId) {
      return res.status(400).json({
        error: "Invalid YouTube Video ID or URL format",
      });
    }

    // 이미 처리 중인지 확인
    const existingLog = await DBSbYoutubeVideoProcessingLog.selectByVideoId(videoId);
    const isProcessing = existingLog.data?.[0]?.processing_status === 'processing';

    if (isProcessing) {
      return res.json({
        success: true,
        videoId,
        message: 'Already processing',
        statusUrl: `/api/main/video-status/${videoId}`
      });
    }

    // 즉시 응답
    res.json({ 
      success: true, 
      videoId,
      message: 'Processing started',
      statusUrl: `/api/main/video-status/${videoId}`
    });
    
    // 백그라운드 처리
    processYoutubeVideoData(videoId).catch(err => {
      console.error(`Background processing failed for ${videoId}:`, err);
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Initial validation failed:', err);
    
    return res.status(500).json({
      error: "Failed to initiate video processing",
      message: err.message
    });
  }
}
