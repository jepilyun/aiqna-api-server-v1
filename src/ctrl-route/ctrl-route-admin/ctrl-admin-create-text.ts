import { TRequestCreateContent } from "aiqna_common_v1";
import { Request, Response } from "express";
import DBSqlProcessingLogText from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-text.js";
import { QueryHashManager } from "../../utils/query-hash-manager.js";
import { createContentText } from "../../ctrl-process/ctrl-create-content/create-content-text.js";

/**
 * Ctrl For Create Text
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateText(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestCreateContent;

    if (!data.blog?.content) {
      return res.status(400).json({
        error: "Text Content is required",
      });
    }

    // 이미 처리 중인지 확인
    const existingLog =
      await DBSqlProcessingLogText.selectByHashKey(
        QueryHashManager.hash16(data.text?.content || "")
      );
    const isProcessing =
      existingLog.data?.[0]?.processing_status === "processing";

    if (isProcessing) {
      return res.json({
        success: true,
        hashKey: QueryHashManager.hash16(data.text?.content || ""),
        message: "Already processing",
        statusUrl: `/api/process-status/text`,
      });
    }

    // 즉시 응답
    res.json({
      success: true,
      hashKey: QueryHashManager.hash16(data.text?.content || ""),
      message: "Processing started",
      statusUrl: `/api/process-status/text`,
    });

    // 백그라운드 처리
    createContentText(
      data.text?.content || "",
      data.text?.title || "",
    ).catch((err) => {
      console.error(`Background processing failed for ${data.text?.content}:`, err);
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
