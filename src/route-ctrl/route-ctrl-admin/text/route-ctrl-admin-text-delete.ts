import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { MSG_TEXT } from "../../../consts/msg/msg-text.js";
import DBSqlText from "../../../db-ctrl/db-ctrl-sql/db-sql-text.js";

/**
 * Text 삭제
 * @route DELETE /api/admin/text/delete/:hashKey
 */
export const routeCtrlAdminTextDelete: RequestHandler = async (req, res) => {
  const { hashKey } = req.params;

  try {
    const dbResponse = await DBSqlText.deleteByHashKey(hashKey);
    resSuccess(res, MSG_TEXT.delete.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_TEXT.delete.error, null, 500);
    return;
  }
};
