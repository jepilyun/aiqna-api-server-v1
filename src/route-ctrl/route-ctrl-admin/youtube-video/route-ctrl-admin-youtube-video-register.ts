// ctrl-admin-create-youtube-video.ts
import { Request, Response } from "express";
import { HelperYouTube } from "../../../utils/helper-youtube.js";
import DBSqlProcessingLogYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { registerYouTubeVideo } from "../../../ctrl/ctrl-register/register-youtube-video.js";
import { TRegisterRequestYouTubeVideoData } from "../../../types/shared.js";
import { MSG_YOUTUBE_VIDEO } from "../../../consts/msg/msg-youtube-video.js";

/**
 * Ctrl For Register YouTube Video
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminYouTubeVideoRegister(req: Request, res: Response) {
  try {
    const { videoId, isShorts } = req.body as TRegisterRequestYouTubeVideoData;
    const extractedVideoId = HelperYouTube.extractVideoId(videoId);

    if (!extractedVideoId) {
      throw new Error(MSG_YOUTUBE_VIDEO.register.error_no_video_id);
    }

    // 공통 헬퍼 사용
    const result = await HelperContentProcessing.processContent<TRegisterRequestYouTubeVideoData>(
      { videoId, isShorts },
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

    res.json({
      success: result.success,
      uniqueKey: result.uniqueKey,
      status: result.status,
    });
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
