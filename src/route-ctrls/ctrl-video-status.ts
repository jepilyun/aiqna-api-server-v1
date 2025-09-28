import { Request, Response } from "express";
import DBSbYoutubeVideoProcessingLog from "../db-ctrls/db-sb-ctrls/db-sb-youtube-video-processing-log.js";

/**
 * YouTube Video Process Controller
 * @param req
 * @param res
 * @returns
 */
export async function ctrlVideoStatus(req: Request, res: Response) {
  try {
    const { videoId } = req.params;

    const log = await DBSbYoutubeVideoProcessingLog.selectByVideoId(videoId);
    const status = log.data?.[0];

    if (!status) {
      return res.status(404).json({
        error: "Video not found",
        videoId,
      });
    }

    return res.json({
      videoId,
      status: status.processing_status,
      progress: {
        api_fetched: status.is_api_data_fetched || false,
        transcript_fetched: status.is_transcript_fetched || false,
        pinecone_processed: status.is_pinecone_processed || false,
      },
      error: status.error_message || null,
      updated_at: status.updated_at,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Status check failed:", err);

    return res.status(500).json({
      error: "Failed to get video status",
      message: err.message,
    });
  }
}
