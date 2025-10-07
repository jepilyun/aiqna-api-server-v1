import { Request, Response } from "express";
import DBSqlProcessingLogInstagramPost from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-instagram-post.js";
import { createContentInstagramPost } from "../../ctrl-process/ctrl-create-content/create-content-instagram-post.js";

/**
 * Ctrl For Create Instagram Post
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateInstagramPost(req: Request, res: Response) {
  try {
    const instagramUrl = req.body.instagramUrl;

    if (!instagramUrl) {
      return res.status(400).json({
        error: "Instagram Post URL is required",
      });
    }

    // 이미 처리 중인지 확인
    const existingLog =
      await DBSqlProcessingLogInstagramPost.selectByPostUrl(instagramUrl);
    const isProcessing =
      existingLog.data?.[0]?.processing_status === "processing";

    if (isProcessing) {
      return res.json({
        success: true,
        instagramUrl,
        message: "Already processing",
        statusUrl: `/api/process-status/instagram-post`,
      });
    }

    // 즉시 응답
    res.json({
      success: true,
      instagramUrl,
      message: "Processing started",
      statusUrl: `/api/process-status/instagram-post`,
    });

    // 백그라운드 처리
    createContentInstagramPost(instagramUrl).catch((err) => {
      console.error(`Background processing failed for ${instagramUrl}:`, err);
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
