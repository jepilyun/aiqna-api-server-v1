import {
  Pinecone,
  // type Index,
  // type RecordMetadata,
  // type RecordMetadataValue,
} from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.PINECONE_API_KEY;

if (!apiKey) throw new Error("PINECONE_API_KEY 가 설정되지 않았습니다.");

const pineconeClient = new Pinecone({ apiKey });

export default pineconeClient;

// 메타데이터 타입들 (참고용)
// type LooseMetadata = Record<string, RecordMetadataValue>;

// 비디오 트랜스크립트용 메타데이터 타입
// export interface VideoTranscriptMetadata extends RecordMetadata {
//   videoId: string;
//   videoTitle: string;
//   text: string;
//   startTime: number;
//   endTime: number;
//   chunkIndex: number;
//   createdAt: string;
// }

// ============================================
// 사용 예시들 🚀
// ============================================

// 예시 1: 기본 사용법 (타입 없음)
// const example1 = async () => {
//   const indexName = 'video-transcripts';
//   const index = pinecone.index(indexName);

//   // 벡터 삽입
//   await index.upsert([
//     {
//       id: 'video1_chunk1',
//       values: [0.1, 0.2, 0.3], // 실제로는 1536차원 벡터
//       metadata: {
//         videoId: 'dQw4w9WgXcQ',
//         text: 'Never gonna give you up'
//       }
//     }
//   ]);

//   // 검색
//   const results = await index.query({
//     vector: [0.1, 0.2, 0.3],
//     topK: 5,
//     includeMetadata: true
//   });

//   console.log(results);
// };

// // 예시 2: 타입 안전한 사용법 (추천)
// const example2 = async () => {
//   const indexName = 'video-transcripts';
//   const index = pinecone.index<VideoTranscriptMetadata>(indexName);

//   // 벡터 삽입 (타입 체크됨)
//   await index.upsert([
//     {
//       id: 'video1_chunk1',
//       values: [0.1, 0.2, 0.3],
//       metadata: {
//         videoId: 'dQw4w9WgXcQ',        // ✅ 타입 체크
//         videoTitle: 'Never Gonna Give You Up',
//         text: 'Never gonna give you up',
//         startTime: 0,
//         endTime: 30,
//         chunkIndex: 0,
//         createdAt: new Date().toISOString()
//       }
//     }
//   ]);

//   // 검색 (타입 안전)
//   const results = await index.query({
//     vector: [0.1, 0.2, 0.3],
//     topK: 5,
//     includeMetadata: true,
//     filter: {
//       videoId: { $eq: 'dQw4w9WgXcQ' }  // 메타데이터 필터링
//     }
//   });

//   // 결과에서 메타데이터 접근 시 자동완성 됨!
//   results.matches?.forEach(match => {
//     if (match.metadata) {
//       console.log(match.metadata.videoTitle);  // ✅ 자동완성
//       console.log(match.metadata.startTime);   // ✅ 자동완성
//     }
//   });
// };

// // 예시 3: 환경변수에서 인덱스 이름 가져오기
// const example3 = async () => {
//   const indexName = process.env.PINECONE_INDEX_01 || 'video-transcripts';
//   const index = pinecone.index<VideoTranscriptMetadata>(indexName);

//   // 나머지는 동일...
// };

// // 예시 4: 실제 YouTube 트랜스크립트 처리 함수
// export const saveTranscriptToPinecone = async (
//   videoId: string,
//   videoTitle: string,
//   transcriptChunks: Array<{
//     text: string;
//     startTime: number;
//     endTime: number;
//     chunkIndex: number;
//   }>,
//   indexName: string = 'video-transcripts'
// ) => {
//   const index = pinecone.index<VideoTranscriptMetadata>(indexName);

//   // 임베딩 생성 (여기서는 예시로 더미 벡터 사용)
//   const vectors = transcriptChunks.map((chunk, idx) => ({
//     id: `${videoId}_chunk_${chunk.chunkIndex}`,
//     values: Array(1536).fill(0).map(() => Math.random()), // 실제로는 OpenAI 등으로 생성
//     metadata: {
//       videoId,
//       videoTitle,
//       text: chunk.text,
//       startTime: chunk.startTime,
//       endTime: chunk.endTime,
//       chunkIndex: chunk.chunkIndex,
//       createdAt: new Date().toISOString()
//     }
//   }));

//   // Pinecone에 업로드 (배치 처리)
//   const batchSize = 100;
//   for (let i = 0; i < vectors.length; i += batchSize) {
//     const batch = vectors.slice(i, i + batchSize);
//     await index.upsert(batch);
//   }

//   console.log(`✅ ${vectors.length}개 벡터를 Pinecone에 저장했습니다.`);
// };

// // 예시 5: 검색 함수
// export const searchTranscripts = async (
//   queryVector: number[],
//   videoId?: string,
//   indexName: string = 'video-transcripts'
// ) => {
//   const index = pinecone.index<VideoTranscriptMetadata>(indexName);

//   const queryOptions: any = {
//     vector: queryVector,
//     topK: 10,
//     includeMetadata: true
//   };

//   // 특정 비디오로 필터링
//   if (videoId) {
//     queryOptions.filter = {
//       videoId: { $eq: videoId }
//     };
//   }

//   const results = await index.query(queryOptions);

//   return results.matches?.map(match => ({
//     id: match.id,
//     score: match.score,
//     text: match.metadata?.text,
//     videoTitle: match.metadata?.videoTitle,
//     startTime: match.metadata?.startTime,
//     endTime: match.metadata?.endTime
//   })) || [];
// };

// ============================================
// 다른 파일에서 사용하는 방법
// ============================================

/*
// server.js 또는 다른 파일에서
import { pinecone, VideoTranscriptMetadata } from './pinecone.js';

const processVideo = async () => {
  // 직접 인덱스 접근
  const index = pinecone.index<VideoTranscriptMetadata>('video-transcripts');
  
  // 또는 동적으로 인덱스 이름 전달
  const indexName = process.env.PINECONE_INDEX_01 || 'video-transcripts';
  const dynamicIndex = pinecone.index<VideoTranscriptMetadata>(indexName);
  
  // 검색 실행
  const results = await index.query({
    vector: embeddings,
    topK: 5,
    includeMetadata: true
  });
};
*/
