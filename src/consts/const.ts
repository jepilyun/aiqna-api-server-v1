import { EMBEDDING_MODEL, PINECONE_INDEX_NAME } from "aiqna_common_v1";

/**
 * Max Tries
 */
export const MAX_RETRIES = 3;


// Pinecone Embedding Provider 설정 파일
export const PROVIDER_CONFIGS = [
  {
    type: "openai",
    model: EMBEDDING_MODEL.OPENAI.SMALL,
    index: PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
  },
  // {
  //   type: 'cohere',
  //   model: EMBEDDING_MODEL.COHERE.MULTI,
  //   index: PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.COHERE_MULTI
  // },
  // {
  //   type: 'voyage',
  //   model: EMBEDDING_MODEL.VOYAGE.LARGE_2,
  //   index: PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.VOYAGE_LARGE_2
  // },
  // {
  //   type: 'huggingface',
  //   model: EMBEDDING_MODEL.HUGGINGFACE.KO_SROBERTA_MULTITASK,
  //   index: PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.HF_KOREAN
  // }
] as const;