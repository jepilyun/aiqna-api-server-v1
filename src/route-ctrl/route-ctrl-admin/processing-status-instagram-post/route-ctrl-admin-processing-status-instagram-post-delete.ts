import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_INSTAGRAM_POST } from "../../../consts/msg/msg-processing-status-instagram-post.js";
import DBSqlProcessingLogInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";

/**
 * Processing Status Instagram Post Delete
 * @route DELETE /api/admin/processing-status/instagram-post/delete/:id
 */
export const routeCtrlAdminProcessingStatusInstagramPostDelete: RequestHandler =
  async (req, res) => {
    const { id } = req.params;

    if (
      !checkRequiredFieldsAreProvided(
        id,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.error.no_id,
        res,
      )
    ) {
      return;
    }

    try {
      const dbResponse = await DBSqlProcessingLogInstagramPost.deleteById(
        Number(id),
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.delete.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.delete.error,
        null,
        500,
      );
      return;
    }
  };
