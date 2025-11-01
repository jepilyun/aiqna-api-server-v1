import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlProcessingLogTextUpdate } from "aiqna_common_v1";
import { MSG_PROCESSING_STATUS_TEXT } from "../../../consts/msg/msg-processing-status-text.js";
import DBSqlProcessingLogText from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";

/**
 * Processing Status Text Update
 * @route PUT /api/admin/processing-status/text/update/:id
 */
export const routeCtrlAdminProcessingStatusTextUpdate: RequestHandler = async (
  req,
  res,
) => {
  const { id } = req.params;
  const updateData = req.body as TSqlProcessingLogTextUpdate;

  if (
    !checkRequiredFieldsAreProvided(
      id,
      MSG_PROCESSING_STATUS_TEXT.error.no_id,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlProcessingLogText.updateById(
      Number(id),
      updateData,
    );
    resSuccess(
      res,
      MSG_PROCESSING_STATUS_TEXT.update.success,
      null,
      200,
      dbResponse,
    );
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_PROCESSING_STATUS_TEXT.update.error, null, 500);
    return;
  }
};
