import { Request, Response } from "express";
import DBSqlProcessingLogBlogPost from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-blog-post.js";
import { createContentBlogPost } from "../../ctrl-process/ctrl-create-content/create-content-blog-post.js";
import { TRequestCreateContent } from "aiqna_common_v1";

/**
 * Ctrl For Create Blog Post
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateBlogPost(req: Request, res: Response) {
  try {
    const { data } = req.body as TRequestCreateContent;

    if (!data.blog?.blogPostUrl) {
      return res.status(400).json({
        error: "Blog Post URL is required",
      });
    }

    // 이미 처리 중인지 확인
    const existingLog =
      await DBSqlProcessingLogBlogPost.selectByPostUrl(data.blog?.blogPostUrl);
    const isProcessing =
      existingLog.data?.[0]?.processing_status === "processing";

    if (isProcessing) {
      return res.json({
        success: true,
        blogUrl: data.blog?.blogPostUrl,
        message: "Already processing",
        statusUrl: `/api/process-status/blog-post`,
      });
    }

    // 즉시 응답
    res.json({
      success: true,
      blogUrl: data.blog?.blogPostUrl,
      message: "Processing started",
      statusUrl: `/api/process-status/blog-post`,
    });

    // 백그라운드 처리
    createContentBlogPost(
      data.blog?.blogPostUrl,
      data.blog?.title || "",
      data.blog?.content || "",
      data.blog?.publishedDate,
      data.blog?.tags,
      data.blog?.platform,
      data.blog?.platformUrl
    ).catch((err) => {
      console.error(`Background processing failed for ${data.blog?.blogPostUrl}:`, err);
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Initial validation failed:", err);

    return res.status(500).json({
      error: "Failed to initiate video processing",
      message: err.message,
    });
  }
}
