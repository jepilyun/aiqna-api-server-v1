import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { MSG_YOUTUBE_VIDEO } from "../../../consts/msg/msg-youtube-video.js";
import DBSqlYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";

/**
 * YouTube Video 수정
 * @route DELETE /api/admin/youtube-video/delete/:videoId
 */
export const routeCtrlAdminYouTubeVideoDelete: RequestHandler = async (
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
    const dbResponse = await DBSqlYoutubeVideo.deleteByVideoId(
      videoId,
    );
    resSuccess(res, MSG_YOUTUBE_VIDEO.delete.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_YOUTUBE_VIDEO.delete.error, null, 500);
    return;
  }
};
