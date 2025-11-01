import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_YOUTUBE_VIDEO } from "../../../consts/msg/msg-processing-status-youtube-video.js";
import DBSqlProcessingLogYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";

/**
 * Processing Status YouTube Video Detail
 * @route GET /api/admin/processing-status/youtube-video/detail/:videoId
 */
export const routeCtrlAdminProcessingStatusYouTubeVideoDetail: RequestHandler =
  async (req, res) => {
    const { videoId } = req.params;

    if (
      !checkRequiredFieldsAreProvided(
        videoId,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.error.no_video_id,
        res,
      )
    ) {
      return;
    }

    try {
      const dbResponse =
        await DBSqlProcessingLogYoutubeVideo.selectByVideoId(videoId);
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.get_detail.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.get_detail.error,
        null,
        500,
      );
      return;
    }
  };
