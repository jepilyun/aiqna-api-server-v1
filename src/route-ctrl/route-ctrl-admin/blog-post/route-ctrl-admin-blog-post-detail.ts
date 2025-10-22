import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_BLOG_POST } from "../../../consts/msg/msg-blog-post.js";
import DBSqlBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-blog-post.js";

/**
 * Blog Post 상세 조회
 * @route GET /api/admin/blog-post/detail
 */
export const routeCtrlAdminBlogPostDetail: RequestHandler = async (
  req,
  res,
) => {
  const { uuid36 } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      uuid36,
      MSG_BLOG_POST.error.no_uuid36,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlBlogPost.selectByUuid36(
      uuid36,
    );
    resSuccess(res, MSG_BLOG_POST.get_detail.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_BLOG_POST.get_detail.error, null, 500);
    return;
  }
};
