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
  // 1. 입력 검증 로그 (맨 앞)
  console.log('\n=== chunkTranscript Debug ===');
  console.log('Input segments count:', segments?.length || 0);
  
  if (!segments || segments.length === 0) {
    console.warn('⚠️  Empty or undefined segments array');
    console.log('============================\n');
    return [];
  }
  
  console.log('First segment sample:', {
    text: segments[0]?.text?.substring(0, 50) + '...',
    start: segments[0]?.start,
    duration: segments[0]?.duration,
    hasText: !!segments[0]?.text,
    hasStart: segments[0]?.start !== undefined,
    hasDuration: segments[0]?.duration !== undefined
  });
  
  const chunks: Array<{ text: string; startTime: number; endTime: number }> = [];
  
  let currentChunk = '';
  let currentEndTime = 0;
  let chunkStartTime = segments[0]?.start || 0;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    // 2. 세그먼트 데이터 검증 (첫 5개만)
    if (i < 5) {
      console.log(`Segment ${i}:`, {
        text: segment.text ? `${segment.text.substring(0, 30)}...` : 'NO TEXT',
        start: segment.start,
        duration: segment.duration
      });
    }
    
    const segmentText = segment.text + ' ';
    
    if (currentChunk.length === 0) {
      chunkStartTime = segment.start;
    }
    
    currentEndTime = segment.start + segment.duration;
    
    if (currentChunk.length + segmentText.length > maxChunkSize && currentChunk.length > 0) {
      // 3. chunk 생성 로그
      console.log(`Creating chunk: ${currentChunk.length} chars, time ${chunkStartTime}-${currentEndTime}`);
      
      chunks.push({
        text: currentChunk.trim(),
        startTime: chunkStartTime,
        endTime: currentEndTime
      });
      
      const overlapText = currentChunk.slice(-overlapSize);
      currentChunk = overlapText + segmentText;
      chunkStartTime = segment.start;
    } else {
      currentChunk += segmentText;
    }
  }
  
  // 4. 마지막 chunk
  if (currentChunk.trim().length > 0) {
    console.log(`Creating final chunk: ${currentChunk.length} chars`);
    chunks.push({
      text: currentChunk.trim(),
      startTime: chunkStartTime,
      endTime: currentEndTime
    });
  }
  
  // 5. 결과 요약 (맨 끝)
  console.log(`\n✅ Generated ${chunks.length} chunks from ${segments.length} segments`);
  console.log('============================\n');
  
  return chunks;
}