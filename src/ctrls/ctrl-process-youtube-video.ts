import { Request, Response } from "express";
// import supabase from "../config/supabase.js";
import { fetchYoutubeVideoTranscript } from "../youtube/fetch-youtube-video-transcript.js";
// import { saveToPinecone } from "../pinecone/save-to-pinecone";
import { getClientIp } from "../utils/get-client-ip.js";
import { extractVideoId } from "../youtube/extract-video-id.js";
import DBSbYoutubeVideoProcessingLog from "../db-sb-ctrls/db-sb-youtube/db-sb-youtube-video-processing-log.js";
import { fetchYoutubeVideoMetadata } from "../youtube/fetch-youtube-video-metadata.js";

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
        const youtubeVideoApiData = await fetchYoutubeVideoMetadata(videoId);
        console.log("youtubeVideoApiData =====>", youtubeVideoApiData);
      }

      if (!youtubeVideoProcessingLog.data[0].is_transcript_fetched) {
        // fetch YouTube transcript
        const youtubeVideoTranscript = await fetchYoutubeVideoTranscript(videoId);
        console.log("youtubeVideoTranscript =====>", youtubeVideoTranscript);
      }

      if (!youtubeVideoProcessingLog.data[0].is_pinecone_processed) {
        // save to Pinecone
      }
    } else {
      // 새로 생성
      const youtubeVideoApiData = await fetchYoutubeVideoMetadata(videoId);
      console.log("youtubeVideoApiData =====>", youtubeVideoApiData);
  
      const youtubeVideoTranscript = await fetchYoutubeVideoTranscript(videoId);
      console.log("youtubeVideoTranscript =====>", youtubeVideoTranscript);
  
      // save to Pinecone
    }
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Database query error: ${err.message}`);
  }
  
  // // 2. 레코드가 없으면 새로 생성
  // if (!videoRecord) {
  //   const { data: newRecord, error: insertError } = await supabase
  //     .from("videos")
  //     .insert({
  //       video_id: videoId,
  //       is_json_saved: false,
  //       is_video_api_fetched: false,
  //       is_pinecone_saved_index_01: false,
  //     })
  //     .select()
  //     .single();

  //   if (insertError) {
  //     throw new Error(`Failed to create video record: ${insertError.message}`);
  //   }

  //   videoRecord = newRecord as TYouTubeVideoRow;
  // }

  // let transcriptData: {
  //   videoTitle: string;
  //   transcript: TranscriptSegment[];
  // } | null = null;
  // let videoMetadata: TYouTubeVideoMetadata | null = null;

  // 3. is_json_saved가 false이면 트랜스크립트 가져오기
  // if (!videoRecord.is_json_saved) {
  //   console.log(`Fetching transcript for video ${videoId}...`);
  //   transcriptData = await fetchYouTubeTranscript(videoId);

  //   // 트랜스크립트를 데이터베이스에 저장
  //   const { error: updateError } = await supabase
  //     .from("videos")
  //     .update({
  //       transcript_json: transcriptData,
  //       video_title: transcriptData.videoTitle,
  //       is_json_saved: true,
  //       updated_at: new Date().toISOString(),
  //     })
  //     .eq("video_id", videoId);

  //   if (updateError) {
  //     throw new Error(`Failed to save transcript: ${updateError.message}`);
  //   }

  //   console.log(`Transcript saved for video ${videoId}`);
  // } else {
  //   // 이미 저장된 트랜스크립트 사용
  //   transcriptData = videoRecord.transcript_json;
  // }

  // 4. is_video_api_fetched가 false이면 YouTube API로 메타데이터 가져오기
  // if (!videoRecord.is_video_api_fetched) {
  //   console.log(`Fetching video metadata for ${videoId}...`);
  //   videoMetadata = await fetchVideoMetadata(videoId);

  //   // 메타데이터를 데이터베이스에 저장
  //   const { error: updateError } = await supabase
  //     .from("videos")
  //     .update({
  //       video_metadata: videoMetadata,
  //       is_video_api_fetched: true,
  //       updated_at: new Date().toISOString(),
  //     })
  //     .eq("video_id", videoId);

  //   if (updateError) {
  //     throw new Error(`Failed to save video metadata: ${updateError.message}`);
  //   }

  //   console.log(`Video metadata saved for ${videoId}`);
  // } else {
  //   // 이미 저장된 메타데이터 사용
  //   videoMetadata = videoRecord.video_metadata;
  // }

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
