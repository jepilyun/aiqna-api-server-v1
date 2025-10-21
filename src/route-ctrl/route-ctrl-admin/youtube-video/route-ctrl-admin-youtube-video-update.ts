import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { MSG_YOUTUBE_VIDEO } from "../../../consts/msg/msg-youtube-video.js";
import DBSqlYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlYoutubeVideoDetailUpdate } from "aiqna_common_v1";

/**
 * YouTube Video 수정
 * @route PUT /api/admin/youtube-video/update/:videoId
 */
export const routeCtrlAdminYouTubeVideoUpdate: RequestHandler = async (
  req,
  res,
) => {
  const { videoId } = req.params;
  const updateData = req.body as TSqlYoutubeVideoDetailUpdate;

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
    const dbResponse = await DBSqlYoutubeVideo.updateByVideoId(
      videoId,
      updateData,
    );
    resSuccess(res, MSG_YOUTUBE_VIDEO.update.success, null, 200, dbResponse);
    return;
  } catch (error: unknown) {
    resError(res, error, MSG_YOUTUBE_VIDEO.update.error, null, 500);
    return;
  }
};
