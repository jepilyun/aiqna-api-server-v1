import { Request, Response } from "express";
import { extractYouTubeVideoId } from "../../ctrl-process/ctrl-create-content/youtube-video/extract-youtube-video-id.js";
import DBSqlProcessingLogYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-youtube-video.js";
import { createContentYouTubeVideo } from "../../ctrl-process/ctrl-create-content/create-content-youtube-video.js";

/**
 * Ctrl For Create YouTube Video
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateYouTubeVideo(req: Request, res: Response) {
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
      await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
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
    createContentYouTubeVideo(videoId).catch((err) => {
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

