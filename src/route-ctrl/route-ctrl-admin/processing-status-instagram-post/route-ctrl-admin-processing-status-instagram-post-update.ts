import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlProcessingLogInstagramPostUpdate } from "aiqna_common_v1";
import { MSG_PROCESSING_STATUS_INSTAGRAM_POST } from "../../../consts/msg/msg-processing-status-instagram-post.js";
import DBSqlProcessingLogInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-instagram-post.js";

/**
 * Processing Status Instagram Post Update
 * @route PUT /api/admin/processing-status/instagram-post/update/:id
 */
export const routeCtrlAdminProcessingStatusInstagramPostUpdate: RequestHandler =
  async (req, res) => {
    const { id } = req.params;
    const updateData = req.body as TSqlProcessingLogInstagramPostUpdate;

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
      const dbResponse = await DBSqlProcessingLogInstagramPost.updateById(
        Number(id),
        updateData,
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.update.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_INSTAGRAM_POST.update.error,
        null,
        500,
      );
      return;
    }
  };
