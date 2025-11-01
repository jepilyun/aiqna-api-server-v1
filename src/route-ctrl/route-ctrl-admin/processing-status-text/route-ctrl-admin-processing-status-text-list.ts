import { LIST_LIMIT } from "aiqna_common_v1";
import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_TEXT } from "../../../consts/msg/msg-processing-status-text.js";
import DBSqlProcessingLogText from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";

/**
 * Processing Status Text List
 * @route GET /api/admin/processing-status/text/list/:start
 */
export const routeCtrlAdminProcessingStatusTextList: RequestHandler = async (
  req,
  res,
) => {
  const { start } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      start,
      MSG_PROCESSING_STATUS_TEXT.error.no_start,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlProcessingLogText.selectList(
      start ? parseInt(start) : 0,
      LIST_LIMIT.default,
    );
    resSuccess(
      res,
      MSG_PROCESSING_STATUS_TEXT.get_list.success,
      null,
      200,
      dbResponse,
    );
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_PROCESSING_STATUS_TEXT.get_list.error, null, 500);
    return;
  }
};
