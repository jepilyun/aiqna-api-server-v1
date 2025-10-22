// ctrl-admin-create-text.ts
import { Request, Response } from "express";
import DBSqlProcessingLogText from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";
import { ContentKeyManager } from "../../../utils/content-key-manager.js";
import { registerText } from "../../../ctrl/ctrl-register/register-text.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { TRegisterRequestTextData } from "../../../types/shared.js";
import { ERequestCreateContentType } from "../../../consts/const.js";

/**
 * Ctrl For Register Text
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminTextRegister(req: Request, res: Response) {
  try {
    const { content, title } = req.body as TRegisterRequestTextData;

    // data: {
    //   text?: {
    //     content: string;
    //     title: string | null;
    //   },
    // }

    const result = await HelperContentProcessing.processContent<TRegisterRequestTextData>(
      { content, title }, 
      {
        extractKey: (data) =>
          ContentKeyManager.createContentKey(
            ERequestCreateContentType.Text,
            data.content,
          ),

        checkExisting: async (hashKey) => {
          const existingLog =
            await DBSqlProcessingLogText.selectByHashKey(hashKey);
          return {
            isProcessing:
              existingLog.data?.[0]?.processing_status === "processing",
          };
        },

        processor: async (data) => {
          await registerText(data.content, data.title || "");
        },

        createResponse: (hashKey, isAlreadyProcessing) => ({
          success: true,
          hashKey,
          message: isAlreadyProcessing
            ? "Already processing"
            : "Processing started",
          statusUrl: `/api/process-status/text`,
        }),
      }
    );

    res.json({
      success: result.success,
      uniqueKey: result.uniqueKey,
      status: result.status,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Text processing failed:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to initiate text processing",
        error: err.message,
      });
    }
  }
}
