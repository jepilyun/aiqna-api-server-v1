// ctrl-admin-create-blog-post.ts
import { Request, Response } from "express";
import { TRequestCreateContent } from "aiqna_common_v1";
import DBSqlProcessingLogBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";
import { processContentBlogPost } from "../../../process/process-create-content/process-create-blog-post.js";
import { HelperContentProcessing } from "../../../services/helper-content-processing.js";

/**
 * ctrlAdminCreateBlogPost
 * Blog Post 처리
 */
export async function ctrlAdminCreateBlogPost(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestCreateContent;

    if (!data.blog?.blogPostUrl) {
      return HelperContentProcessing.sendError(
        res,
        400,
        "Blog Post URL is required",
      );
    }

    await HelperContentProcessing.processContent(res, data.blog, {
      extractKey: (blog) => blog.blogPostUrl,

      checkExisting: async (postUrl) => {
        const existingLog =
          await DBSqlProcessingLogBlogPost.selectByPostUrl(postUrl);
        return {
          isProcessing:
            existingLog.data?.[0]?.processing_status === "processing",
        };
      },

      processor: async (blog) => {
        await processContentBlogPost(
          blog.blogPostUrl,
          blog.title || "",
          blog.content || "",
          blog.publishedDate,
          blog.tags,
          blog.platform,
          blog.platformUrl,
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Blog post processing failed:", err);

    if (!res.headersSent) {
      HelperContentProcessing.sendError(
        res,
        500,
        "Failed to initiate blog processing",
        err.message,
      );
    }
  }
}
