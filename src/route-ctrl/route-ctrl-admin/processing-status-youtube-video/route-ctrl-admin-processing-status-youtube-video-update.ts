import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { TSqlProcessingLogYoutubeVideoUpdate } from "aiqna_common_v1";
import { MSG_PROCESSING_STATUS_YOUTUBE_VIDEO } from "../../../consts/msg/msg-processing-status-youtube-video.js";
import DBSqlProcessingLogYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";

/**
 * Processing Status YouTube Video Update
 * @route PUT /api/admin/processing-status/youtube-video/update/:videoId
 */
export const routeCtrlAdminProcessingStatusYouTubeVideoUpdate: RequestHandler =
  async (req, res) => {
    const { videoId } = req.params;
    const updateData = req.body as TSqlProcessingLogYoutubeVideoUpdate;

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
      const dbResponse = await DBSqlProcessingLogYoutubeVideo.updateByVideoId(
        videoId,
        updateData,
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.update.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.update.error,
        null,
        500,
      );
      return;
    }
  };
