import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlBlogPostDetailUpdate } from "aiqna_common_v1";
import { MSG_BLOG_POST } from "../../../consts/msg/msg-blog-post.js";
import DBSqlBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-blog-post.js";

/**
 * Blog Post 수정
 * @route PUT /api/admin/blog-post/update/:uuid36
 */
export const routeCtrlAdminBlogPostUpdate: RequestHandler = async (
  req,
  res,
) => {
  const { uuid36 } = req.params;
  const updateData = req.body as TSqlBlogPostDetailUpdate;

  if (
    !checkRequiredFieldsAreProvided(uuid36, MSG_BLOG_POST.error.no_uuid36, res)
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlBlogPost.updateByUuid36(uuid36, updateData);
    resSuccess(res, MSG_BLOG_POST.update.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_BLOG_POST.update.error, null, 500);
    return;
  }
};
