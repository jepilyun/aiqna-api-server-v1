// ctrl-admin-create-text.ts
import { Request, Response } from "express";
import DBSqlProcessingLogText from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";
import { ContentKeyManager } from "../../../utils/content-key-manager.js";
import { registerText } from "../../../ctrl/ctrl-register/register-text.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { TRegisterRequestTextData, TRequestRegisterText } from "../../../types/shared.js";
import { ERequestCreateContentType } from "../../../consts/const.js";

/**
 * Ctrl For Register Text
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminRegisterText(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestRegisterText;

    // data: {
    //   text?: {
    //     content: string;
    //     title: string | null;
    //   },
    // }

    if (data.length === 0 || !data[0]?.content) {
      return res.status(400).json({
        success: false,
        message: "Text Content is required",
      });
    }

    const response = Array<{ success: boolean; uniqueKey: string; status: string }>();

    for (const item of data) {
      const result = await HelperContentProcessing.processContent<TRegisterRequestTextData>(item, {
        extractKey: (item) =>
          ContentKeyManager.createContentKey(
            ERequestCreateContentType.Text,
            item.content,
          ),

        checkExisting: async (hashKey) => {
          const existingLog =
            await DBSqlProcessingLogText.selectByHashKey(hashKey);
          return {
            isProcessing:
              existingLog.data?.[0]?.processing_status === "processing",
          };
        },

        processor: async (item) => {
          await registerText(item.content, item.title || "");
        },

        createResponse: (hashKey, isAlreadyProcessing) => ({
          success: true,
          hashKey,
          message: isAlreadyProcessing
            ? "Already processing"
            : "Processing started",
          statusUrl: `/api/process-status/text`,
        }),
      });

      response.push({
        success: result.success,
        uniqueKey: result.uniqueKey,
        status: result.status,
      });
    }
    res.json(response);
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
