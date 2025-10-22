import {
  LIST_LIMIT,
} from "aiqna_common_v1";
import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_TEXT } from "../../../consts/msg/msg-text.js";
import DBSqlText from "../../../db-ctrl/db-ctrl-sql/db-sql-text.js";

/**
 * Text 목록 조회
 * @route GET /api/admin/text/list/:start
 */
export const routeCtrlAdminTextList: RequestHandler = async (
  req,
  res,
) => {
  const { start } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      start,
      MSG_TEXT.error.no_start,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlText.selectList(
      start ? parseInt(start) : 0,
      LIST_LIMIT.default,
    );
    resSuccess(res, MSG_TEXT.get_list.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_TEXT.get_list.error, null, 500);
    return;
  }
};

