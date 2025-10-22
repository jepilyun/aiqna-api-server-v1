import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlInstagramPostDetailUpdate } from "aiqna_common_v1";
import { MSG_INSTAGRAM_POST } from "../../../consts/msg/msg-instagram-post.js";
import DBSqlInstagramPost from "../../../db-ctrl/db-ctrl-sql/db-sql-instagram-post.js";

/**
 * Instagram Post 수정
 * @route PUT /api/admin/instagram-post/update/:uuid36
 */
export const routeCtrlAdminInstagramPostUpdate: RequestHandler = async (
  req,
  res,
) => {
  const { uuid36 } = req.params;
  const updateData = req.body as TSqlInstagramPostDetailUpdate;

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
    const dbResponse = await DBSqlInstagramPost.updateByUuid36(
      uuid36,
      updateData,
    );
    resSuccess(res, MSG_INSTAGRAM_POST.update.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_INSTAGRAM_POST.update.error, null, 500);
    return;
  }
};
