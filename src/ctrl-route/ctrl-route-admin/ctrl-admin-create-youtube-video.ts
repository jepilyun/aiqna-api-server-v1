// ctrl-admin-create-youtube-video.ts
import { Request, Response } from "express";
import { YouTubeHelper } from "../../utils/youtube-helper.js";
import DBSqlProcessingLogYoutubeVideo from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-youtube-video.js";
import { createContentYouTubeVideo } from "../../ctrl-process/ctrl-create-content/create-content-youtube-video.js";
import { ContentProcessingHelper } from "../../utils/content-processing-helper.js";

export async function ctrlAdminCreateYouTubeVideo(req: Request, res: Response) {
  try {
    const videoUrlOrId = req.body.id;

    if (!videoUrlOrId) {
      return ContentProcessingHelper.sendError(
        res,
        400,
        "Video ID or URL is required"
      );
    }

    const videoId = YouTubeHelper.extractVideoId(videoUrlOrId as string);

    if (!videoId) {
      return ContentProcessingHelper.sendError(
        res,
        400,
        "Invalid YouTube Video ID or URL format"
      );
    }

    // 공통 헬퍼 사용
    await ContentProcessingHelper.processContent(res, { videoId }, {
      extractKey: (data) => data.videoId,
      
      checkExisting: async (videoId) => {
        const existingLog = await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
        return {
          isProcessing: existingLog.data?.[0]?.processing_status === "processing",
          data: existingLog.data?.[0],
        };
      },
      
      processor: async (data) => {
        await createContentYouTubeVideo(data.videoId);
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
      ContentProcessingHelper.sendError(
        res,
        500,
        "Failed to initiate video processing",
        err.message
      );
    }
  }
}