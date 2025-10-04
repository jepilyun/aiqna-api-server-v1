import { TYouTubeTranscriptStandardSegment, TYouTubeTranscriptSegment } from "aiqna_common_v1";

/**
 * convertSegmentsToPineconeFormat
 * TYouTubeTranscriptSegment[]을 TPineconeYouTubeTranscriptSegment[]으로 변환
 * @param segments TYouTubeTranscriptSegment[]
 * @returns 
 */
export function convertYouTubeTranscriptSegmentsToStandard(
  segments: TYouTubeTranscriptSegment[],
): TYouTubeTranscriptStandardSegment[] {
  return segments.map((seg: TYouTubeTranscriptSegment) => {
    return {
      text: seg.transcript_segment_renderer.snippet?.text || "", // text 필드 확인
      start: seg.transcript_segment_renderer.start_ms
        ? parseInt(seg.transcript_segment_renderer.start_ms) / 1000
        : 0,
      duration: seg.transcript_segment_renderer.end_ms
        ? (parseInt(seg.transcript_segment_renderer.end_ms) -
            parseInt(seg.transcript_segment_renderer.start_ms || "0")) /
          1000
        : 0,
    };
  });
}
