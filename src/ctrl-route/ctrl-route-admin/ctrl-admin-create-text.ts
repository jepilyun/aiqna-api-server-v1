// ctrl-admin-create-text.ts
import { Request, Response } from "express";
import { ERequestCreateContentType, TRequestCreateContent } from "aiqna_common_v1";
import DBSqlProcessingLogText from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-text.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import { createContentText } from "../../ctrl-process/ctrl-create-content/create-content-text.js";
import { ContentProcessingHelper } from "../../utils/content-processing-helper.js";

export async function ctrlAdminCreateText(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestCreateContent;

    if (!data.text?.content) {
      return ContentProcessingHelper.sendError(
        res,
        400,
        "Text Content is required"
      );
    }

    await ContentProcessingHelper.processContent(res, data.text, {
      extractKey: (text) => ContentKeyManager.createContentKey(ERequestCreateContentType.Text, text.content),
      
      checkExisting: async (hashKey) => {
        const existingLog = await DBSqlProcessingLogText.selectByHashKey(hashKey);
        return {
          isProcessing: existingLog.data?.[0]?.processing_status === "processing",
        };
      },
      
      processor: async (text) => {
        await createContentText(text.content, text.title || "");
      },
      
      createResponse: (hashKey, isAlreadyProcessing) => ({
        success: true,
        hashKey,
        message: isAlreadyProcessing ? "Already processing" : "Processing started",
        statusUrl: `/api/process-status/text`,
      }),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Text processing failed:", err);
    
    if (!res.headersSent) {
      ContentProcessingHelper.sendError(
        res,
        500,
        "Failed to initiate text processing",
        err.message
      );
    }
  }
}