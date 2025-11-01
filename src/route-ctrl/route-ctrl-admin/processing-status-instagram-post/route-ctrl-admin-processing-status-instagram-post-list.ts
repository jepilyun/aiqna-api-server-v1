import { LIST_LIMIT } from "aiqna_common_v1";
import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_INSTAGRAM_POST } from "../../../consts/msg/msg-processing-status-instagram-post.js";
import DBSqlProcessingLogInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";

/**
 * Processing Status Instagram Post List
 * @route GET /api/admin/processing-status/instagram-post/list/:start
 */
export const routeCtrlAdminProcessingStatusInstagramPostList: RequestHandler =
  async (req, res) => {
    const { start } = req.params;

    if (
      !checkRequiredFieldsAreProvided(
        start,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.error.no_start,
        res,
      )
    ) {
      return;
    }

    try {
      const dbResponse = await DBSqlProcessingLogInstagramPost.selectList(
        start ? parseInt(start) : 0,
        LIST_LIMIT.default,
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.get_list.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.get_list.error,
        null,
        500,
      );
      return;
    }
  };
