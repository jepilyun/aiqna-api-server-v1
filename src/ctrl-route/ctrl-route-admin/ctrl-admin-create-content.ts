import { Request, Response } from "express";
import {
  ERequestCreateContentType,
  TRequestCreateContent,
} from "aiqna_common_v1";
import { requestYouTubeVideoProcessing } from "../../process/process-create-content/request-youtube-video-processing.js";
import { processCreateInstagramPost } from "../../process/process-create-content/process-create-instagram-post.js";
import { processContentBlogPost } from "../../process/process-create-content/process-create-blog-post.js";
import { processCreateText } from "../../process/process-create-content/process-create-text.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";

// 타입 정의 개선
type ContentValidator<T> = (data: T) => { isValid: boolean; error?: string };
type ContentProcessor<T> = (data: T) => Promise<void>;

// 각 타입별 성공 응답 타입 정의
type YouTubeSuccessResponse = {
  success: true;
  videoId: string;
  message: string;
  statusUrl: string;
};

type InstagramSuccessResponse = {
  success: true;
  instagramUrl: string;
  message: string;
  statusUrl: string;
};

type BlogSuccessResponse = {
  success: true;
  blogUrl: string;
  message: string;
  statusUrl: string;
};

type TextSuccessResponse = {
  success: true;
  text: string;
  contentKey: string;
  message: string;
  statusUrl: string;
};

// Union 타입으로 통합
type SuccessResponse =
  | YouTubeSuccessResponse
  | InstagramSuccessResponse
  | BlogSuccessResponse
  | TextSuccessResponse;

// 공통 유틸리티
class ContentProcessingUtils {
  static async processContent<T>(
    res: Response,
    data: T,
    validator: ContentValidator<T>,
    processor: ContentProcessor<T>,
    successResponse: SuccessResponse,
  ): Promise<void> {
    // 1. 먼저 검증
    const validation = validator(data);
    if (!validation.isValid) {
      throw new Error(validation.error || "Validation failed");
    }

    // 2. 검증 성공 후 응답
    res.json(successResponse);

    // 3. 백그라운드 처리 (응답 후)
    processor(data).catch((err) => {
      console.error(`Background processing failed:`, err);
    });
  }

  static getValidationError(type: string, field: string): string {
    return `${field} is required for ${type} type`;
  }
}

// 각 타입별 검증 함수
const validators = {
  [ERequestCreateContentType.YoutubeVideo]: (
    data: TRequestCreateContent["data"],
  ): { isValid: boolean; error?: string } => {
    if (!data.youtubeVideo?.videoId) {
      return {
        isValid: false,
        error: ContentProcessingUtils.getValidationError(
          "YouTube Video",
          "videoId",
        ),
      };
    }
    return { isValid: true };
  },

  [ERequestCreateContentType.Instagram]: (
    data: TRequestCreateContent["data"],
  ): { isValid: boolean; error?: string } => {
    if (!data.instagram?.instagramPostUrl) {
      return {
        isValid: false,
        error: ContentProcessingUtils.getValidationError(
          "Instagram",
          "instagramPostUrl",
        ),
      };
    }
    return { isValid: true };
  },

  [ERequestCreateContentType.Blog]: (
    data: TRequestCreateContent["data"],
  ): { isValid: boolean; error?: string } => {
    if (!data.blog?.blogPostUrl) {
      return {
        isValid: false,
        error: ContentProcessingUtils.getValidationError("Blog", "blogPostUrl"),
      };
    }
    return { isValid: true };
  },

  [ERequestCreateContentType.Text]: (
    data: TRequestCreateContent["data"],
  ): { isValid: boolean; error?: string } => {
    if (!data.text?.content) {
      return {
        isValid: false,
        error: ContentProcessingUtils.getValidationError("Text", "content"),
      };
    }
    return { isValid: true };
  },
};

// 각 타입별 프로세서 함수
const processors = {
  [ERequestCreateContentType.YoutubeVideo]: async (
    data: TRequestCreateContent["data"],
  ): Promise<void> => {
    if (!data.youtubeVideo?.videoId) {
      throw new Error("Video ID is missing");
    }
    await requestYouTubeVideoProcessing(data.youtubeVideo.videoId);
  },

  [ERequestCreateContentType.Instagram]: async (
    data: TRequestCreateContent["data"],
  ): Promise<void> => {
    if (!data.instagram) {
      throw new Error("Instagram data is missing");
    }
    const instagram = data.instagram;
    await processCreateInstagramPost(
      instagram.instagramPostUrl,
      instagram.description,
      instagram.userId,
      instagram.userProfileUrl,
      instagram.postDate,
      instagram.tags,
    );
  },

  [ERequestCreateContentType.Blog]: async (
    data: TRequestCreateContent["data"],
  ): Promise<void> => {
    if (!data.blog) {
      throw new Error("Blog data is missing");
    }
    const blog = data.blog;
    await processContentBlogPost(
      blog.blogPostUrl,
      blog.title || "",
      blog.content || "",
      blog.publishedDate,
      blog.tags,
      blog.platform,
      blog.platformUrl,
    );
  },

  [ERequestCreateContentType.Text]: async (
    data: TRequestCreateContent["data"],
  ): Promise<void> => {
    if (!data.text) {
      throw new Error("Text data is missing");
    }
    const text = data.text;
    await processCreateText(text.content, text.title);
  },
};

// 각 타입별 성공 응답 생성 함수
const responseGenerators: {
  [K in ERequestCreateContentType]: (
    data: TRequestCreateContent["data"],
  ) => SuccessResponse;
} = {
  [ERequestCreateContentType.YoutubeVideo]: (
    data: TRequestCreateContent["data"],
  ): YouTubeSuccessResponse => {
    if (!data.youtubeVideo?.videoId) {
      throw new Error("Video ID is missing");
    }
    return {
      success: true,
      videoId: data.youtubeVideo.videoId,
      message: "Processing started",
      statusUrl: `/api/process-status/youtube-video/${data.youtubeVideo.videoId}`,
    };
  },

  [ERequestCreateContentType.Instagram]: (
    data: TRequestCreateContent["data"],
  ): InstagramSuccessResponse => {
    if (!data.instagram?.instagramPostUrl) {
      throw new Error("Instagram URL is missing");
    }
    return {
      success: true,
      instagramUrl: data.instagram.instagramPostUrl,
      message: "Processing started",
      statusUrl: `/api/process-status/instagram-post`,
    };
  },

  [ERequestCreateContentType.Blog]: (
    data: TRequestCreateContent["data"],
  ): BlogSuccessResponse => {
    if (!data.blog?.blogPostUrl) {
      throw new Error("Blog URL is missing");
    }
    return {
      success: true,
      blogUrl: data.blog.blogPostUrl,
      message: "Processing started",
      statusUrl: `/api/process-status/blog-post`,
    };
  },

  [ERequestCreateContentType.Text]: (
    data: TRequestCreateContent["data"],
  ): TextSuccessResponse => {
    if (!data.text?.content) {
      throw new Error("Text content is missing");
    }
    const contentKey = ContentKeyManager.createContentKey(
      ERequestCreateContentType.Text,
      data.text.content,
    );

    return {
      success: true,
      text: data.text.content,
      contentKey,
      message: "Processing started",
      statusUrl: `/api/process-status/text`,
    };
  },
};

/**
 * Ctrl For Create Content (Text, YouTube Video, Instagram, Blog)
 */
export async function ctrlAdminCreateContent(req: Request, res: Response) {
  try {
    const { type, data } = req.body as TRequestCreateContent;

    console.log(`📥 Received request - Type: ${type}`); // 👈 디버깅 로그 추가

    // 지원하지 않는 타입 체크
    if (!validators[type]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported content type: ${type}`,
      });
    }

    // 1. 먼저 검증
    const validation = validators[type](data);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error || "Validation failed",
      });
    }

    // 2. 검증 성공 후 응답 생성
    const successResponse = responseGenerators[type](data);
    
    console.log(`✅ Validation passed, sending response`); // 👈 디버깅 로그
    
    // 3. 응답 전송
    res.json(successResponse);

    // 4. 백그라운드 처리 (응답 후)
    console.log(`🔄 Starting background processing for ${type}`); // 👈 디버깅 로그
    
    processors[type](data).catch((err) => {
      console.error(`❌ Background processing failed for ${type}:`, err);
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Content processing failed:", err);

    if (!res.headersSent) {
      return res.status(400).json({
        success: false,
        error: "Failed to initiate content processing",
        message: err.message,
      });
    }
  }
}