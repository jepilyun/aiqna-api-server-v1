// ctrl-admin-create-youtube-video.ts
import { Request, Response } from "express";
import { YouTubeHelper } from "../../content/content-youtube-video/youtube-helper.js";
import DBSqlProcessingLogYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import { processCreateYouTubeVideo } from "../../process/process-create-content/process-create-youtube-video.js";
import { HelperContentProcessing } from "../../content/content-common/helper-content-processing.js";

export async function ctrlAdminCreateYouTubeVideo(req: Request, res: Response) {
  try {
    const videoUrlOrId = req.body.id;

    if (!videoUrlOrId) {
      return HelperContentProcessing.sendError(
        res,
        400,
        "Video ID or URL is required"
      );
    }

    const videoId = YouTubeHelper.extractVideoId(videoUrlOrId as string);

    if (!videoId) {
      return HelperContentProcessing.sendError(
        res,
        400,
        "Invalid YouTube Video ID or URL format"
      );
    }

    // 공통 헬퍼 사용
    await HelperContentProcessing.processContent(res, { videoId }, {
      extractKey: (data) => data.videoId,
      
      checkExisting: async (videoId) => {
        const existingLog = await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
        return {
          isProcessing: existingLog.data?.[0]?.processing_status === "processing",
          data: existingLog.data?.[0],
        };
      },
      
      processor: async (data) => {
        await processCreateYouTubeVideo(data.videoId);
      },
      
      createResponse: (videoId, isAlreadyProcessing) => ({
        success: true,
        videoId,
        message: isAlreadyProcessing ? "Already processing" : "Processing started",
        statusUrl: `/api/process-status/youtube-video/${videoId}`,
      }),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("YouTube video processing failed:", err);
    
    if (!res.headersSent) {
      HelperContentProcessing.sendError(
        res,
        500,
        "Failed to initiate video processing",
        err.message
      );
    }
  }
}