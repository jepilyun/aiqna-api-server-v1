import { pinecone } from "../config/pinecone.js";
import { generateEmbeddings } from "../embedding/generate-embeddings.js";
import { TTranscriptSegment } from "../types/youtube.js";

// Pinecone에 벡터 저장
// export async function saveToPinecone(
//   videoId: string,
//   transcript: TTranscriptSegment[],
//   videoTitle: string,
// ) {
//   try {
//     const index = pinecone.Index(process.env.PINECONE_INDEX_01!);

//     // 트랜스크립트를 청크 단위로 나누기 (예: 30초 단위)
//     const chunks: {
//       text: string;
//       startTime: number;
//       endTime: number;
//       chunkIndex: number;
//     }[] = [];
//     let currentChunk = "";
//     let chunkStartTime = 0;
//     let chunkIndex = 0;

//     for (const segment of transcript) {
//       if (currentChunk === "") {
//         chunkStartTime = segment.offset;
//       }

//       currentChunk += segment.text + " ";

//       // 30초 단위로 청크 분할
//       if (segment.offset - chunkStartTime >= 30 || currentChunk.length > 1000) {
//         chunks.push({
//           text: currentChunk.trim(),
//           startTime: chunkStartTime,
//           endTime: segment.offset + segment.duration,
//           chunkIndex,
//         });
//         currentChunk = "";
//         chunkIndex++;
//       }
//     }

//     // 마지막 청크 처리
//     if (currentChunk.trim()) {
//       chunks.push({
//         text: currentChunk.trim(),
//         startTime: chunkStartTime,
//         endTime:
//           transcript[transcript.length - 1].offset +
//           transcript[transcript.length - 1].duration,
//         chunkIndex,
//       });
//     }

//     // 임베딩 생성
//     const texts = chunks.map((chunk) => chunk.text);
//     const embeddings = await generateEmbeddings(texts);

//     // Pinecone에 저장할 벡터 준비
//     const vectors = chunks.map((chunk, idx) => ({
//       id: `${videoId}_chunk_${chunk.chunkIndex}`,
//       values: embeddings[idx],
//       metadata: {
//         videoId,
//         videoTitle,
//         text: chunk.text,
//         startTime: chunk.startTime,
//         endTime: chunk.endTime,
//         chunkIndex: chunk.chunkIndex,
//         createdAt: new Date().toISOString(),
//       },
//     }));

//     // Pinecone에 벡터 업서트
//     await index.upsert(vectors);

//     console.log(
//       `Successfully saved ${vectors.length} vectors to Pinecone for video ${videoId}`,
//     );
//   } catch (error) {
//     console.error("Error saving to Pinecone:", error);
//     throw error;
//   }
// }
