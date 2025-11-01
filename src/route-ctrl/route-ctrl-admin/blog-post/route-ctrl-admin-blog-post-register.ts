import { Request, Response } from "express";
import DBSqlProcessingLogBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";
import { registerBlogPost } from "../../../ctrl/ctrl-register/register-blog-post.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { TRegisterRequestBlogPostData } from "../../../types/shared.js";

/**
 * Ctrl For Register Blog Post
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminBlogPostRegister(
  req: Request,
  res: Response,
) {
  try {
    const {
      blogPostUrl,
      title,
      content,
      publishedDate,
      tags,
      platform,
      platformUrl,
    } = req.body as TRegisterRequestBlogPostData;

    // data: {
    //   blog?: {
    //     blogPostUrl: string;
    //     title: string | null;
    //     content: string | null;
    //     tags: string[];
    //     platform: string | null;
    //     platformUrl: string | null;
    //     publishedDate: string | null;
    //   },
    // }

    const result =
      await HelperContentProcessing.processContent<TRegisterRequestBlogPostData>(
        {
          blogPostUrl,
          title,
          content,
          publishedDate,
          tags,
          platform,
          platformUrl,
        },
        {
          extractKey: (data) => data.blogPostUrl,

          checkExisting: async (postUrl) => {
            const existingLog =
              await DBSqlProcessingLogBlogPost.selectByPostUrl(postUrl);
            return {
              isProcessing:
                existingLog.data?.[0]?.processing_status === "processing",
            };
          },

          processor: async (data) => {
            await registerBlogPost(
              data.blogPostUrl,
              data.title || "",
              data.content || "",
              data.publishedDate,
              data.tags,
              data.platform,
              data.platformUrl,
            );
          },

          createResponse: (postUrl, isAlreadyProcessing) => ({
            success: true,
            blogUrl: postUrl,
            message: isAlreadyProcessing
              ? "Already processing"
              : "Processing started",
            statusUrl: `/api/process-status/blog-post`,
          }),
        },
      );

    res.json({
      success: result.success,
      uniqueKey: result.uniqueKey,
      status: result.status,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Blog post processing failed:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to initiate blog processing",
        error: err.message,
      });
    }
  }
}
