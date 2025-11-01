import { EMBEDDING_MODEL, PINECONE_INDEX_NAME } from "aiqna_common_v1";

/**
 * Request Create Content Type Enum
 */
export enum ERequestCreateContentType {
  YoutubeVideo = "youtubeVideo",
  Instagram = "instagram",
  Blog = "blog",
  Text = "text",
}

/**
 * Request Processing Status Enum
 */
export enum EProcessingStatusType {
  pending = "pending",
  processing = "processing",
  completed = "completed",
  failed = "failed",
}

/**
 * Max Tries
 */
export const MAX_RETRIES = 3;

// Pinecone Embedding Provider 설정 파일
export const PROVIDER_CONFIGS = {
  openai: {
    type: "openai",
    model: EMBEDDING_MODEL.OPENAI.SMALL,
    index: PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
  },
};
