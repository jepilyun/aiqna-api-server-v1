import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_INSTAGRAM_POST } from "../../../consts/msg/msg-instagram-post.js";
import DBSqlInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-instagram-post.js";

/**
 * Instagram Post 상세 조회
 * @route GET /api/admin/instagram-post/detail
 */
export const routeCtrlAdminInstagramPostDetail: RequestHandler = async (
  req,
  res,
) => {
  const { uuid36 } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      uuid36,
      MSG_INSTAGRAM_POST.error.no_uuid36,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlInstagramPost.selectByUuid36(uuid36);
    resSuccess(
      res,
      MSG_INSTAGRAM_POST.get_detail.success,
      null,
      200,
      dbResponse,
    );
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_INSTAGRAM_POST.get_detail.error, null, 500);
    return;
  }
};
