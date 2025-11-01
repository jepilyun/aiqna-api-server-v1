import { LIST_LIMIT } from "aiqna_common_v1";
import { RequestHandler } from "express";
import { resError, resSuccess } from "../../../utils/response.js";
import { checkRequiredFieldsAreProvided } from "../../../utils/check-required-fields.js";
import { MSG_PROCESSING_STATUS_YOUTUBE_VIDEO } from "../../../consts/msg/msg-processing-status-youtube-video.js";
import DBSqlProcessingLogYoutubeVideo from "../../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";

/**
 * Processing Status YouTube Video List
 * @route GET /api/admin/processing-status/youtube-video/list/:start
 */
export const routeCtrlAdminProcessingStatusYouTubeVideoList: RequestHandler =
  async (req, res) => {
    const { start } = req.params;

    if (
      !checkRequiredFieldsAreProvided(
        start,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.error.no_start,
        res,
      )
    ) {
      return;
    }

    try {
      const dbResponse = await DBSqlProcessingLogYoutubeVideo.selectList(
        start ? parseInt(start) : 0,
        LIST_LIMIT.default,
      );
      resSuccess(
        res,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.get_list.success,
        null,
        200,
        dbResponse,
      );
      return;
    } catch (error: unknown) {
      resError(
        res,
        error,
        MSG_PROCESSING_STATUS_YOUTUBE_VIDEO.get_list.error,
        null,
        500,
      );
      return;
    }
  };
