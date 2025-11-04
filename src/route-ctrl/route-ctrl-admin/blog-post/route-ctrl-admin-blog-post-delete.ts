import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_BLOG_POST } from "../../../consts/msg/msg-blog-post.js";
import DBSqlBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-blog-post.js";

/**
 * Blog Post 삭제
 * @route DELETE /api/admin/blog-post/delete/:uuid36
 */
export const routeCtrlAdminBlogPostDelete: RequestHandler = async (
  req,
  res,
) => {
  const { uuid36 } = req.params;

  if (
    !checkRequiredFieldsAreProvided(uuid36, MSG_BLOG_POST.error.no_uuid36, res)
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlBlogPost.deleteByUuid36(uuid36);
    resSuccess(res, MSG_BLOG_POST.delete.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_BLOG_POST.delete.error, null, 500);
    return;
  }
};
