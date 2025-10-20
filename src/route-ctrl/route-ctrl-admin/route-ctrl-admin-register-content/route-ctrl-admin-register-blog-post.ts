import { Request, Response } from "express";
import DBSqlProcessingLogBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";
import { registerBlogPost } from "../../../ctrl/ctrl-register/register-blog-post.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";
import { TRegisterRequestBlogPostData, TRequestRegisterBlogPost } from "../../../types/shared.js";

/**
 * Ctrl For Register Blog Post
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminRegisterBlogPost(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestRegisterBlogPost;

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

    if (data.length === 0 || !data[0]?.blogPostUrl) {
      return res.status(400).json({
        success: false,
        message: "Blog Post URL is required",
      });
    }

    const response = Array<{ success: boolean; uniqueKey: string; status: string }>();

    for (const item of data) {
      const result = await HelperContentProcessing.processContent<TRegisterRequestBlogPostData>(item, {
        extractKey: (item) => item.blogPostUrl,

        checkExisting: async (postUrl) => {
          const existingLog =
            await DBSqlProcessingLogBlogPost.selectByPostUrl(postUrl);
          return {
            isProcessing:
              existingLog.data?.[0]?.processing_status === "processing",
          };
        },

        processor: async (item) => {
          await registerBlogPost(
            item.blogPostUrl,
            item.title || "",
            item.content || "",
            item.publishedDate,
            item.tags,
            item.platform,
            item.platformUrl,
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
