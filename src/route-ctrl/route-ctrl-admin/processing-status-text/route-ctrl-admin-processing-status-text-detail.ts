import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_TEXT } from "../../../consts/msg/msg-processing-status-text.js";
import DBSqlProcessingLogText from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";

/**
 * Processing Status Text Detail
 * @route GET /api/admin/processing-status/text/detail/:id
 */
export const routeCtrlAdminProcessingStatusTextDetail: RequestHandler = async (
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
    const dbResponse = await DBSqlProcessingLogText.selectById(Number(id));
    resSuccess(
      res,
      MSG_PROCESSING_STATUS_TEXT.get_detail.success,
      null,
      200,
      dbResponse,
    );
    return;
  } catch (error: unknown) {
    resError(
      res,
      error,
      MSG_PROCESSING_STATUS_TEXT.get_detail.error,
      null,
      500,
    );
    return;
  }
};
