import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlProcessingLogBlogPostUpdate } from "aiqna_common_v1";
import { MSG_PROCESSING_STATUS_BLOG_POST } from "../../../consts/msg/msg-processing-status-blog-post.js";
import DBSqlProcessingLogBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-blog-post.js";

/**
 * Processing Status Blog Post Update
 * @route PUT /api/admin/processing-status/blog-post/update/:id
 */
export const routeCtrlAdminProcessingStatusBlogPostUpdate: RequestHandler =
  async (req, res) => {
    const { id } = req.params;
    const updateData = req.body as TSqlProcessingLogBlogPostUpdate;

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
      const dbResponse = await DBSqlProcessingLogBlogPost.updateById(
        Number(id),
        updateData,
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_BLOG_POST.update.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_BLOG_POST.update.error,
        null,
        500,
      );
      return;
    }
  };
