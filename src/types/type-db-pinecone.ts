/**
 * Pinecone 비디오 메타데이터 타입
 */
export type TPinconeVideoMetadata = {
  // 비디오 식별 정보
  video_id: string;
  video_title: string;
  channel_name: string;
  
  // 텍스트 정보
  text: string;
  text_length: number;
  
  // 시간 정보
  start_time: number;    // 초 단위
  end_time: number;      // 초 단위
  duration: number;      // 초 단위
  
  // 청크 정보
  chunk_index: number;   // 해당 비디오 내에서의 청크 순서
  chunk_id: string;      // video_id + "_chunk_" + chunk_index
  
  // 분류 정보
  category?: string;
  language: string;
  
  // 메타 정보
  created_at: string;    // ISO 8601
  embedding_model: string; // 사용된 임베딩 모델명
}

/**
 * Pinecone 벡터 전체 구조
 */
export type TPinconeVector = {
  id: string;                    // chunk_id
  values: number[];              // 임베딩 벡터 (보통 1536차원)
  metadata: TPinconeVideoMetadata;
}