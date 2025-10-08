// ctrl-admin-create-instagram-post.ts
import { Request, Response } from "express";
import { TRequestCreateContent } from "aiqna_common_v1";
import DBSqlProcessingLogInstagramPost from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-instagram-post.js";
import { createContentInstagramPost } from "../../ctrl-process/ctrl-create-content/create-content-instagram-post.js";
import { ContentProcessingHelper } from "../../utils/content-processing-helper.js";

export async function ctrlAdminCreateInstagramPost(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestCreateContent;

    if (!data.instagram?.instagramPostUrl) {
      return ContentProcessingHelper.sendError(
        res,
        400,
        "Instagram Post URL is required"
      );
    }

    await ContentProcessingHelper.processContent(res, data.instagram, {
      extractKey: (instagram) => instagram.instagramPostUrl,
      
      checkExisting: async (postUrl) => {
        const existingLog = await DBSqlProcessingLogInstagramPost.selectByPostUrl(postUrl);
        return {
          isProcessing: existingLog.data?.[0]?.processing_status === "processing",
        };
      },
      
      processor: async (instagram) => {
        await createContentInstagramPost(
          instagram.instagramPostUrl,
          instagram.description,
          instagram.userId,
          instagram.userProfileUrl,
          instagram.postDate,
          instagram.tags
        );
      },
      
      createResponse: (postUrl, isAlreadyProcessing) => ({
        success: true,
        instagramUrl: postUrl,
        message: isAlreadyProcessing ? "Already processing" : "Processing started",
        statusUrl: `/api/process-status/instagram-post`,
      }),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Instagram post processing failed:", err);
    
    if (!res.headersSent) {
      ContentProcessingHelper.sendError(
        res,
        500,
        "Failed to initiate instagram processing",
        err.message
      );
    }
  }
}