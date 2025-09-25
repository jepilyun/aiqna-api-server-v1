import { TAnySegment, TCueGroupSegment, TCueRenderer, TGenericSegment, TSnippet, TTextRun, TTranscriptSegment, TTranscriptSegmentRenderer } from "../types/youtube";


/**
 * 타입 가드: TranscriptSegment 여부 확인
 */
export function isTranscriptSegment(
  segment: TAnySegment,
): segment is TTranscriptSegment {
  return (
    "transcript_segment_renderer" in segment &&
    segment.transcript_segment_renderer !== undefined
  );
}

/**
 * 타입 가드: CueGroupSegment 여부 확인
 */
export function isCueGroupSegment(
  segment: TAnySegment,
): segment is TCueGroupSegment {
  return (
    "cue_group_renderer" in segment && segment.cue_group_renderer !== undefined
  );
}

/**
 * 타입 가드: GenericSegment 여부 확인
 */
export function isGenericSegment(
  segment: TAnySegment,
): segment is TGenericSegment {
  return !isTranscriptSegment(segment) && !isCueGroupSegment(segment);
}

/**
 * YouTube 트랜스크립트의 다양한 세그먼트 형식에서 텍스트를 추출하는 헬퍼 함수
 */
export const extractTextFromSegment = (
  segment: TAnySegment | TTranscriptSegmentRenderer | TCueRenderer,
): string => {
  // ... 기존 로직 그대로 ...

  // 1. TranscriptSegmentRenderer가 직접 전달된 경우
  if ("snippet" in segment || "text" in segment || "runs" in segment) {
    const tsr = segment as TTranscriptSegmentRenderer;
    if (tsr.snippet?.text) return tsr.snippet.text;
    if (tsr.text) return tsr.text;
    if (tsr.snippet?.runs)
      return tsr.snippet.runs.map((run) => run.text).join("");
    if (tsr.runs) return tsr.runs.map((run) => run.text).join("");
  }

  // 2. CueRenderer가 직접 전달된 경우
  if ("start_offset_ms" in segment || "duration_ms" in segment) {
    const cue = segment as TCueRenderer;
    if (cue.text?.text) return cue.text.text;
    if (cue.text?.runs) return cue.text.runs.map((run) => run.text).join("");
  }

  // 3. TranscriptSegment 처리
  if (isTranscriptSegment(segment)) {
    const tsr = segment.transcript_segment_renderer;
    if (tsr.snippet?.text) return tsr.snippet.text;
    if (tsr.text) return tsr.text;
    if (tsr.snippet?.runs)
      return tsr.snippet.runs.map((run) => run.text).join("");
    if (tsr.runs) return tsr.runs.map((run) => run.text).join("");
  }

  // 4. CueGroupSegment 처리
  if (isCueGroupSegment(segment)) {
    const cue = segment.cue_group_renderer.cues?.[0]?.cue_renderer;
    if (cue?.text?.text) return cue.text.text;
    if (cue?.text?.runs) return cue.text.runs.map((run) => run.text).join("");
  }

  // 5. GenericSegment 처리
  if (isGenericSegment(segment)) {
    if (typeof segment.text === "string") return segment.text;

    if (typeof segment.text === "object" && segment.text) {
      const snippet = segment.text as TSnippet;
      if (snippet.text) return snippet.text;
      if (snippet.runs) return snippet.runs.map((run: TTextRun) => run.text).join("");
    }

    if (segment.runs) return segment.runs.map((run) => run.text).join("");

    if (segment.snippet) {
      if (segment.snippet.text) return segment.snippet.text;
      if (segment.snippet.runs)
        return segment.snippet.runs.map((run) => run.text).join("");
    }
  }

  return "";
};
