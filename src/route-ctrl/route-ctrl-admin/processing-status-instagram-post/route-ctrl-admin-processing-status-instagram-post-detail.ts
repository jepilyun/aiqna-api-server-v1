import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_INSTAGRAM_POST } from "../../../consts/msg/msg-processing-status-instagram-post.js";
import DBSqlProcessingLogInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";

/**
 * Processing Status Instagram Post Detail
 * @route GET /api/admin/processing-status/instagram-post/detail/:id
 */
export const routeCtrlAdminProcessingStatusInstagramPostDetail: RequestHandler =
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
      const dbResponse = await DBSqlProcessingLogInstagramPost.selectById(
        Number(id),
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.get_detail.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.get_detail.error,
        null,
        500,
      );
      return;
    }
  };
