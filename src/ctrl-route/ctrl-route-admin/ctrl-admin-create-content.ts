import { Request, Response } from "express";
import { createContentYouTubeVideo } from "../../ctrl-process/ctrl-create-content/create-content-youtube-video.js";
import { ERequestCreateContentType, TRequestCreateContent } from "aiqna_common_v1";
import { createContentInstagramPost } from "../../ctrl-process/ctrl-create-content/create-content-instagram-post.js";
import { createContentBlogPost } from "../../ctrl-process/ctrl-create-content/create-content-blog-post.js";
import { createContentText } from "../../ctrl-process/ctrl-create-content/create-content-text.js";

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
          videoId: data.youtubeVideo?.videoId,
          message: "Processing started",
          statusUrl: `/api/process-status/youtube-video/${data.youtubeVideo?.videoId}`,
        });

        if (!data.youtubeVideo?.videoId) {
          throw new Error("Video ID does not exist.")
        }

        createContentYouTubeVideo(data.youtubeVideo?.videoId).catch((err) => {
          console.error(`Background processing failed for ${data.youtubeVideo?.videoId}:`, err);
        });
        break;
      case ERequestCreateContentType.Instagram:
        res.json({
          success: true,
          instagramUrl: data.instagram?.instagramPostUrl,
          message: "Processing started",
          statusUrl: `/api/process-status/instagram-post`,
        });

        if (!data.instagram?.instagramPostUrl) {
          throw new Error("Instagram URL does not exist.")
        }

        createContentInstagramPost(
          data.instagram?.instagramPostUrl,
          data.instagram?.description,
          data.instagram?.userId,
          data.instagram?.userProfileUrl,
          data.instagram?.postDate,
          data.instagram?.tags
        ).catch((err) => {
          console.error(`Background processing failed for ${data.instagram?.instagramPostUrl}:`, err);
        });
        break;
      case ERequestCreateContentType.Blog:
        res.json({
          success: true,
          blogUrl: data.blog?.blogPostUrl,
          message: "Processing started",
          statusUrl: `/api/process-status/blog-post`,
        });

        if (!data.blog?.blogPostUrl) {
          throw new Error("Blog URL does not exist.")
        }

        createContentBlogPost(
          data.blog?.blogPostUrl,
          data.blog?.title || "",
          data.blog?.content || "",
          data.blog?.publishedDate,
          data.blog?.tags,
          data.blog?.platform,
          data.blog?.platformUrl
        ).catch((err) => {
          console.error(`Background processing failed for ${data}:`, err);
        });
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

        createContentText(
          data.text.content,
          data.text.title
        ).catch((err) => {
          console.error(`Background processing failed for ${data}:`, err);
        });
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
