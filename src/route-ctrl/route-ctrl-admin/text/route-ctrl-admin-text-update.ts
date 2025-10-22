import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlTextDetailUpdate } from "aiqna_common_v1";
import { MSG_TEXT } from "../../../consts/msg/msg-text.js";
import DBSqlText from "../../../db-ctrl/db-ctrl-sql/db-sql-text.js";

/**
 * Text 수정
 * @route PUT /api/admin/text/update/:hashKey
 */
export const routeCtrlAdminTextUpdate: RequestHandler = async (
  req,
  res,
) => {
  const { hashKey } = req.params;
  const updateData = req.body as TSqlTextDetailUpdate;

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
    const dbResponse = await DBSqlText.updateByHashKey(
      hashKey,
      updateData,
    );
    resSuccess(res, MSG_TEXT.update.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_TEXT.update.error, null, 500);
    return;
  }
};
