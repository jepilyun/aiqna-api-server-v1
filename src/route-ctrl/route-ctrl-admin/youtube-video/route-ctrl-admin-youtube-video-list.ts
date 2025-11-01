import { LIST_LIMIT } from "aiqna_common_v1";
import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { MSG_YOUTUBE_VIDEO } from "../../../consts/msg/msg-youtube-video.js";
import DBSqlYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";

/**
 * YouTube Video 목록 조회
 * @route GET /api/admin/youtube-video/list/:start
 */
export const routeCtrlAdminYouTubeVideoList: RequestHandler = async (
  req,
  res,
) => {
  const { start } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      start,
      MSG_YOUTUBE_VIDEO.error.no_start,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlYoutubeVideo.selectList(
      start ? parseInt(start) : 0,
      LIST_LIMIT.default,
    );
    resSuccess(res, MSG_YOUTUBE_VIDEO.get_list.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_YOUTUBE_VIDEO.get_list.error, null, 500);
    return;
  }
};
