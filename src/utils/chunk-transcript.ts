import { TPineconeTranscriptSegment } from "aiqna_common_v1";

/**
 * Transcript를 적절한 크기의 chunk로 분할
 * @param segments - 트랜스크립트 세그먼트 배열
 * @param maxChunkSize - 최대 chunk 크기 (기본: 1000자)
 * @param overlapSize - chunk 간 겹치는 크기 (기본: 200자)
 */
export function chunkTranscript(
  segments: TPineconeTranscriptSegment[],
  maxChunkSize: number = 1000,
  overlapSize: number = 200
): Array<{ text: string; startTime: number; endTime: number }> {
  const chunks: Array<{ text: string; startTime: number; endTime: number }> = [];
  
  let currentChunk = '';
  // let currentStartTime = 0;
  let currentEndTime = 0;
  let chunkStartTime = segments[0]?.start || 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentText = segment.text + ' ';
    
    // 첫 세그먼트이거나 chunk가 비어있으면 시작 시간 설정
    if (currentChunk.length === 0) {
      chunkStartTime = segment.start;
    }
    
    currentEndTime = segment.start + segment.duration;
    
    // chunk 크기 체크
    if (currentChunk.length + segmentText.length > maxChunkSize && currentChunk.length > 0) {
      // 현재 chunk 저장
      chunks.push({
        text: currentChunk.trim(),
        startTime: chunkStartTime,
        endTime: currentEndTime
      });
      
      // overlap을 위해 마지막 부분 일부를 다음 chunk로 이월
      const overlapText = currentChunk.slice(-overlapSize);
      currentChunk = overlapText + segmentText;
      chunkStartTime = segment.start;
    } else {
      currentChunk += segmentText;
    }
  }
  
  // 마지막 chunk 추가
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      startTime: chunkStartTime,
      endTime: currentEndTime
    });
  }
  
  return chunks;
}
