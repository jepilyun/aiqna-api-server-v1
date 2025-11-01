import { LIST_LIMIT } from "aiqna_common_v1";
import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_BLOG_POST } from "../../../consts/msg/msg-blog-post.js";
import DBSqlBlogPost from "../../../db-ctrl/db-ctrl-sql/db-sql-blog-post.js";

/**
 * Blog Post 목록 조회
 * @route GET /api/admin/blog-post/list/:start
 */
export const routeCtrlAdminBlogPostList: RequestHandler = async (req, res) => {
  const { start } = req.params;

  if (
    !checkRequiredFieldsAreProvided(start, MSG_BLOG_POST.error.no_start, res)
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlBlogPost.selectList(
      start ? parseInt(start) : 0,
      LIST_LIMIT.default,
    );
    resSuccess(res, MSG_BLOG_POST.get_list.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_BLOG_POST.get_list.error, null, 500);
    return;
  }
};
