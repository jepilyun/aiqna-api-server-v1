import { Request, Response } from "express";
import DBSqlProcessingLogInstagramPost from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-instagram-post.js";
import { createContentInstagramPost } from "../../ctrl-process/ctrl-create-content/create-content-instagram-post.js";
import { TRequestCreateContent } from "aiqna_common_v1";

/**
 * Ctrl For Create Instagram Post
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateInstagramPost(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestCreateContent;

    if (!data.instagram?.instagramPostUrl) {
      return res.status(400).json({
        error: "Instagram Post URL is required",
      });
    }

    // 이미 처리 중인지 확인
    const existingLog =
      await DBSqlProcessingLogInstagramPost.selectByPostUrl(data.instagram?.instagramPostUrl);
    const isProcessing =
      existingLog.data?.[0]?.processing_status === "processing";

    if (isProcessing) {
      return res.json({
        success: true,
        instagramUrl: data.instagram?.instagramPostUrl,
        message: "Already processing",
        statusUrl: `/api/process-status/instagram-post`,
      });
    }

    // 즉시 응답
    res.json({
      success: true,
      instagramUrl: data.instagram?.instagramPostUrl,
      message: "Processing started",
      statusUrl: `/api/process-status/instagram-post`,
    });

    // 백그라운드 처리
    createContentInstagramPost(
      data.instagram?.instagramPostUrl,
      data.instagram?.description,
      data.instagram?.userId,
      data.instagram?.userProfileUrl,
      data.instagram?.postDate,
      data.instagram?.tags
    ).catch((err) => {
      console.error(`Background processing failed for ${data.instagram?.instagramPostUrl}:`, err);
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
