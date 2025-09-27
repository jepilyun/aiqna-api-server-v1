import { TPineconeTranscriptSegment, TYouTubeTranscriptSegment } from "aiqna_common_v1";

/**
 * YouTube 트랜스크립트 세그먼트를 Pinecone용 형식으로 변환
 */
// export function convertSegmentsToPineconeFormat(segments: TYouTubeTranscriptSegment[]): TPineconeTranscriptSegment[] {
//   return segments.map(seg => {
//     const renderer = seg.transcript_segment_renderer;
//     const startMs = parseInt(renderer.start_ms || '0');
//     const endMs = parseInt(renderer.end_ms || '0');
    
//     // text 추출: runs가 있으면 합치고, 없으면 text 사용
//     const text = renderer.runs 
//       ? renderer.runs.map(run => run.text).join('') 
//       : (renderer.text || '');
    
//     return {
//       text: text.trim(),
//       start: startMs / 1000, // 밀리초를 초로 변환
//       duration: (endMs - startMs) / 1000
//     };
//   });
// }

// convert-segment-pincone.ts
export function convertSegmentsToPineconeFormat(segments: TYouTubeTranscriptSegment[]): TPineconeTranscriptSegment[] {
  console.log('Converting segments, first item:', segments[0]);
  
  return segments.map((seg: TYouTubeTranscriptSegment) => {
    // 여기서 변환이 잘못되었을 가능성
    console.log('Converting segment:', seg);
    
    return {
      text: seg.transcript_segment_renderer.snippet?.text || '',  // text 필드 확인
      start: seg.transcript_segment_renderer.start_ms ? parseInt(seg.transcript_segment_renderer.start_ms) / 1000 : 0,
      duration: seg.transcript_segment_renderer.end_ms ? (parseInt(seg.transcript_segment_renderer.end_ms) - parseInt(seg.transcript_segment_renderer.start_ms || '0')) / 1000 : 0
    };
  });
}