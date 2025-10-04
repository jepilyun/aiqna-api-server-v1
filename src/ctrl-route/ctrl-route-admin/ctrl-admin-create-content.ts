import { Request, Response } from "express";
import { TRequestCreateContent } from "../../types";
import { ERequestCreateContentType } from "../../consts/const.js";
import { createContentYouTubeVideo } from "../../ctrl-process/ctrl-create-content/create-content-youtube-video.js";

/**
 * Ctrl For Create Content (Text, YouTube Video, Instagram, Blog)
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateContent(req: Request, res: Response) {
  try {
    const { type, data } = req.body as TRequestCreateContent;

    switch (type) {
      case ERequestCreateContentType.YoutubeVideo:
        res.json({
          success: true,
          videoId: data.videoId,
          message: "Processing started",
          statusUrl: `/api/process-status/youtube-video/${data.videoId}`,
        });

        if (!data.videoId) {
          throw new Error("Video ID does not exist.")
        }

        createContentYouTubeVideo(data.videoId).catch((err) => {
          console.error(`Background processing failed for ${data}:`, err);
        });
        break;
      case ERequestCreateContentType.Instagram:
        res.json({
          success: true,
          instagramUrl: data.instagramUrl,
          message: "Processing started",
          statusUrl: `/api/process-status/instagram-post`,
        });

        if (!data.instagramUrl) {
          throw new Error("Instagram URL does not exist.")
        }

        // createContentInstagramPost(data.instagramUrl).catch((err) => {
        //   console.error(`Background processing failed for ${data}:`, err);
        // });
        break;
      case ERequestCreateContentType.Blog:
        res.json({
          success: true,
          blogUrl: data.blogUrl,
          message: "Processing started",
          statusUrl: `/api/process-status/blog-post`,
        });

        if (!data.blogUrl) {
          throw new Error("Blog URL does not exist.")
        }

        // createContentBlogPost(data.blogUrl).catch((err) => {
        //   console.error(`Background processing failed for ${data}:`, err);
        // });
        break;
      case ERequestCreateContentType.Text:
        res.json({
          success: true,
          text: data.text,
          message: "Processing started",
          statusUrl: `/api/process-status/text`,
        });

        if (!data.text) {
          throw new Error("Text does not exist.")
        }

        // createContentText(data.text).catch((err) => {
        //   console.error(`Background processing failed for ${data}:`, err);
        // });
        break;
      default:
        throw new Error(`The type ${type} is not supported.`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Initial validation failed:", err);

    return res.status(500).json({
      error: "Failed to initiate video processing",
      message: err.message,
    });
  }
}
