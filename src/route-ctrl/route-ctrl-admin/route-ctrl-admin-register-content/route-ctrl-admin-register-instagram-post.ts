// ctrl-admin-create-instagram-post.ts
import { Request, Response } from "express";
import DBSqlProcessingLogInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";
import { registerInstagramPost } from "../../../ctrl/ctrl-register/register-instagram-post.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { TRegisterRequestInstagramPostData, TRequestRegisterInstagramPost } from "../../../types/shared.js";

/**
 * Ctrl For Register Instagram Post
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminRegisterInstagramPost(
  req: Request,
  res: Response,
) {
  try {
    const { data } = req.body as TRequestRegisterInstagramPost;

    // data: {
    //   instagram?: {
    //     instagramPostUrl: string;
    //     description: string | null;
    //     tags: string[];
    //     userId: string | null;
    //     userProfileUrl: string | null;
    //     postDate: string | null;
    //   },
    // }

    if (data.length === 0 || !data[0]?.instagramPostUrl) {
      return res.status(400).json({
        success: false,
        message: "Instagram Post URL is required",
      });
    }

    const response = Array<{ success: boolean; uniqueKey: string; status: string }>();

    for (const item of data) {
      const result = await HelperContentProcessing.processContent<TRegisterRequestInstagramPostData>(item, {
        extractKey: (item) => item.instagramPostUrl,

        checkExisting: async (postUrl) => {
          const existingLog =
            await DBSqlProcessingLogInstagramPost.selectByPostUrl(postUrl);
          return {
            isProcessing:
              existingLog.data?.[0]?.processing_status === "processing",
          };
        },

        processor: async (item) => {
          await registerInstagramPost(
            item.instagramPostUrl,
            item.description,
            item.userId,
            item.userProfileUrl,
            item.postDate,
            item.tags,
          );
        },

        createResponse: (postUrl, isAlreadyProcessing) => ({
          success: true,
          instagramUrl: postUrl,
          message: isAlreadyProcessing
            ? "Already processing"
            : "Processing started",
          statusUrl: `/api/process-status/instagram-post`,
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
    console.error("Instagram post processing failed:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to initiate instagram processing",
        error: err.message,
      });
    }
  }
}
