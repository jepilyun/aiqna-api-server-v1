import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_TEXT } from "../../../consts/msg/msg-text.js";
import DBSqlText from "../../../db-ctrl/db-ctrl-sql/db-sql-text.js";

/**
 * Text 상세 조회
 * @route GET /api/admin/text/detail
 */
export const routeCtrlAdminTextDetail: RequestHandler = async (
  req,
  res,
) => {
  const { hashKey } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      hashKey,
      MSG_TEXT.error.no_hashKey,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlText.selectByHashKey(
      hashKey,
    );
    resSuccess(res, MSG_TEXT.get_detail.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_TEXT.get_detail.error, null, 500);
    return;
  }
};
