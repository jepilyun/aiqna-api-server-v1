import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_BLOG_POST } from "../../../consts/msg/msg-processing-status-blog-post.js";
import DBSqlProcessingLogBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";

/**
 * Processing Status Blog Post Delete
 * @route DELETE /api/admin/processing-status/blog-post/delete/:id
 */
export const routeCtrlAdminProcessingStatusBlogPostDelete: RequestHandler =
  async (req, res) => {
    const { id } = req.params;

    if (
      !checkRequiredFieldsAreProvided(
        id,
        MSG_PROCESSING_STATUS_BLOG_POST.error.no_id,
        res,
      )
    ) {
      return;
    }

    try {
      const dbResponse = await DBSqlProcessingLogBlogPost.deleteById(
        Number(id),
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_BLOG_POST.delete.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_BLOG_POST.delete.error,
        null,
        500,
      );
      return;
    }
  };
