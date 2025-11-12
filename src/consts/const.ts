import { EMBEDDING_MODEL, PINECONE_INDEX_NAME } from "aiqna_common_v1";

export const METADATA_GENERATOR_PROVIDER = "openai";              // "openai" 도 가능
export const METADATA_GENERATOR_MODEL = "gpt-4o-mini";
export const METADATA_GENERATOR_MODEL_NAME = "gpt4oMini";

export const METADATA_GENERATOR_DEFAULT_MODELS = [
  { provider: "ollama", model: "llama3.1:8b", modelName: "llama31_8b" },
  { provider: "ollama", model: "gpt-oss:20b", modelName: "gptOss_20b" }, 
  { provider: "ollama", model: "qwen3:8b", modelName: "qwen3_8b" },
  { provider: "ollama", model: "deepseek-r1:14b", modelName: "deepseekR1_14b" },
  { provider: "groq", model: "llama-3.3-70b-versatile", modelName: "llama33_70b_versatile" },
  { provider: "groq", model: "llama-3.1-70b-versatile", modelName: "llama31_70b_versatile" },
  { provider: "groq", model: "llama-3.1-8b-instant", modelName: "llama31_8b_instant" },
  { provider: "openai", model: "gpt-4o-mini", modelName: "gpt4oMini" },
];

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
