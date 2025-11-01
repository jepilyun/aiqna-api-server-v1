import { LIST_LIMIT } from "aiqna_common_v1";
import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_INSTAGRAM_POST } from "../../../consts/msg/msg-instagram-post.js";
import DBSqlInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-instagram-post.js";

/**
 * Instagram Post 목록 조회
 * @route GET /api/admin/instagram-post/list/:start
 */
export const routeCtrlAdminInstagramPostList: RequestHandler = async (
  req,
  res,
) => {
  const { start } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      start,
      MSG_INSTAGRAM_POST.error.no_start,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlInstagramPost.selectList(
      start ? parseInt(start) : 0,
      LIST_LIMIT.default,
    );
    resSuccess(res, MSG_INSTAGRAM_POST.get_list.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_INSTAGRAM_POST.get_list.error, null, 500);
    return;
  }
};
