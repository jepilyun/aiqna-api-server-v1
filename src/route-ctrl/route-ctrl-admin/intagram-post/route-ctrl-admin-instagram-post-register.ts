// ctrl-admin-create-instagram-post.ts
import { Request, Response } from "express";
import DBSqlProcessingLogInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";
import { registerInstagramPost } from "../../../ctrl/ctrl-register/register-instagram-post.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { TRegisterRequestInstagramPostData } from "../../../types/shared.js";

/**
 * Ctrl For Register Instagram Post
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminInstagramPostRegister(
  req: Request,
  res: Response,
) {
  try {
    const { instagramPostUrl, description, tags, userId, userProfileUrl, publishedDate } = req.body as TRegisterRequestInstagramPostData;

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

    const result = await HelperContentProcessing.processContent<TRegisterRequestInstagramPostData>(
      { instagramPostUrl, description, tags, userId, userProfileUrl, publishedDate }, 
      {
        extractKey: (data) => data.instagramPostUrl,

        checkExisting: async (instagramPostUrl) => {
          const existingLog =
            await DBSqlProcessingLogInstagramPost.selectByPostUrl(instagramPostUrl);
          return {
            isProcessing:
              existingLog.data?.[0]?.processing_status === "processing",
          };
        },

        processor: async (data) => {
          await registerInstagramPost(
            data.instagramPostUrl,
            data.description,
            data.userId,
            data.userProfileUrl,
            data.publishedDate,
            data.tags,
          );
        },

        createResponse: (instagramPostUrl, isAlreadyProcessing) => ({
          success: true,
          instagramUrl: instagramPostUrl,
          message: isAlreadyProcessing
            ? "Already processing"
            : "Processing started",
          statusUrl: `/api/process-status/instagram-post`,
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
