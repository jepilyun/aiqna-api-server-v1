import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { MSG_YOUTUBE_VIDEO } from "../../../consts/msg/msg-youtube-video.js";
import DBSqlYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";

/**
 * YouTube Video 상세 조회
 * @route GET /api/admin/youtube-video/detail/:videoId
 */
export const routeCtrlAdminYouTubeVideoDetail: RequestHandler = async (
  req,
  res,
) => {
  const { videoId } = req.params;

  if (
    !checkRequiredFieldsAreProvided(
      videoId,
      MSG_YOUTUBE_VIDEO.error.no_video_id,
      res,
    )
  ) {
    return;
  }

  try {
    const dbResponse = await DBSqlYoutubeVideo.selectByVideoId(videoId);
    resSuccess(
      res,
      MSG_YOUTUBE_VIDEO.get_detail.success,
      null,
      200,
      dbResponse,
    );
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_YOUTUBE_VIDEO.get_detail.error, null, 500);
    return;
  }
};
