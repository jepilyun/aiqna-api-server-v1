// ctrl-admin-create-youtube-video.ts
import { Request, Response } from "express";
import { HelperYouTube } from "../../../utils/helper-youtube.js";
import DBSqlProcessingLogYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { registerYouTubeVideo } from "../../../ctrl/ctrl-register/register-youtube-video.js";
import { TRegisterRequestYouTubeVideoData, TRequestRegisterYouTubeVideo } from "../../../types/shared.js";

/**
 * Ctrl For Register YouTube Video
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminRegisterYouTubeVideo(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestRegisterYouTubeVideo;

    if (data.length === 0 || !data[0]?.videoId) {
      return res.status(400).json({
        success: false,
        message: "Video ID or URL is required",
      });
    }

    const response = Array<{ success: boolean; uniqueKey: string; status: string }>();

    for (const item of data) {
      const videoId = HelperYouTube.extractVideoId(item.videoId);

      if (!videoId) {
        response.push({
          success: false,
          uniqueKey: item.videoId,
          status: "invalid",
        });

        continue;
      }

      // 공통 헬퍼 사용
      const result = await HelperContentProcessing.processContent<TRegisterRequestYouTubeVideoData>(
        item,
        {
          extractKey: (item) => item.videoId,

          checkExisting: async (videoId) => {
            const existingLog =
              await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
            return {
              isProcessing:
                existingLog.data?.[0]?.processing_status === "processing",
              data: existingLog.data?.[0],
            };
          },

          processor: async (item) => {
            await registerYouTubeVideo({ videoId: item.videoId, isShorts: item.isShorts });
          },

          createResponse: (videoId, isAlreadyProcessing) => ({
            success: true,
            videoId,
            message: isAlreadyProcessing
              ? "Already processing"
              : "Processing started",
            statusUrl: `/api/process-status/youtube-video/${videoId}`,
          }),
        },
      );

      response.push({
        success: result.success,
        uniqueKey: result.uniqueKey,
        status: result.status,
      });
    }

    res.json(response);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("YouTube video processing failed:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to initiate video processing",
        error: err.message,
      });
    }
  }
}
