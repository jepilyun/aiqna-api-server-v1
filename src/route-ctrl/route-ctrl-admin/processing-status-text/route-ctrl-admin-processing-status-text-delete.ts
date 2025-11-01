import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_TEXT } from "../../../consts/msg/msg-processing-status-text.js";
import DBSqlProcessingLogText from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";

/**
 * Processing Status Text Delete
 * @route DELETE /api/admin/processing-status/text/delete/:id
 */
export const routeCtrlAdminProcessingStatusTextDelete: RequestHandler = async (
  req,
  res,
) => {
  const { id } = req.params;

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
    const dbResponse = await DBSqlProcessingLogText.deleteById(Number(id));
    resSuccess(
      res,
      MSG_PROCESSING_STATUS_TEXT.delete.success,
      null,
      200,
      dbResponse,
    );
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_PROCESSING_STATUS_TEXT.delete.error, null, 500);
    return;
  }
};
