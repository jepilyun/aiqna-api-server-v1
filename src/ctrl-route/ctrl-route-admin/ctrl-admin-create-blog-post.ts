// ctrl-admin-create-blog-post.ts
import { Request, Response } from "express";
import { TRequestCreateContent } from "aiqna_common_v1";
import DBSqlProcessingLogBlogPost from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-blog-post.js";
import { createContentBlogPost } from "../../ctrl-process/ctrl-create-content/create-content-blog-post.js";
import { ContentProcessingHelper } from "../../utils/content-processing-helper.js";

export async function ctrlAdminCreateBlogPost(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestCreateContent;

    if (!data.blog?.blogPostUrl) {
      return ContentProcessingHelper.sendError(
        res,
        400,
        "Blog Post URL is required"
      );
    }

    await ContentProcessingHelper.processContent(res, data.blog, {
      extractKey: (blog) => blog.blogPostUrl,
      
      checkExisting: async (postUrl) => {
        const existingLog = await DBSqlProcessingLogBlogPost.selectByPostUrl(postUrl);
        return {
          isProcessing: existingLog.data?.[0]?.processing_status === "processing",
        };
      },
      
      processor: async (blog) => {
        await createContentBlogPost(
          blog.blogPostUrl,
          blog.title || "",
          blog.content || "",
          blog.publishedDate,
          blog.tags,
          blog.platform,
          blog.platformUrl
        );
      },
      
      createResponse: (postUrl, isAlreadyProcessing) => ({
        success: true,
        blogUrl: postUrl,
        message: isAlreadyProcessing ? "Already processing" : "Processing started",
        statusUrl: `/api/process-status/blog-post`,
      }),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Blog post processing failed:", err);
    
    if (!res.headersSent) {
      ContentProcessingHelper.sendError(
        res,
        500,
        "Failed to initiate blog processing",
        err.message
      );
    }
  }
}