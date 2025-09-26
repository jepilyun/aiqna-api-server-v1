import { 
  TYouTubeTranscriptAnySegment, 
  TYouTubeTranscriptCueGroupSegment, 
  TYouTubeTranscriptCueRenderer, 
  TYouTubeTranscriptGenericSegment, 
  TYouTubeTranscriptSegment, 
  TYouTubeTranscriptSegmentRenderer, 
  TYouTubeTranscriptSnippet, 
  TYouTubeTranscriptTextRun 
} from "aiqna_common_v1";


/**
 * 타입 가드: TranscriptSegment 여부 확인
 * 
 * @param segment - 검사할 세그먼트
 * @returns transcript_segment_renderer 속성을 가진 세그먼트인지 여부
 * 
 * @example
 * ```typescript
 * const segment: TYouTubeTranscriptAnySegment = {...};
 * 
 * if (isYouTubeTranscriptSegment(segment)) {
 *   // TypeScript가 segment를 TYouTubeTranscriptSegment로 인식
 *   console.log(segment.transcript_segment_renderer.snippet?.text);
 * }
 * ```
 */
export function isYouTubeTranscriptSegment(
  segment: TYouTubeTranscriptAnySegment,
): segment is TYouTubeTranscriptSegment {
  return (
    "transcript_segment_renderer" in segment &&
    segment.transcript_segment_renderer !== undefined
  );
}

/**
 * 타입 가드: CueGroupSegment 여부 확인
 * 
 * @param segment - 검사할 세그먼트
 * @returns cue_group_renderer 속성을 가진 세그먼트인지 여부
 * 
 * @example
 * ```typescript
 * const segment: TYouTubeTranscriptAnySegment = {...};
 * 
 * if (isYouTubeTranscriptCueGroupSegment(segment)) {
 *   // TypeScript가 segment를 TYouTubeTranscriptCueGroupSegment로 인식
 *   const cues = segment.cue_group_renderer.cues;
 * }
 * ```
 */
export function isYouTubeTranscriptCueGroupSegment(
  segment: TYouTubeTranscriptAnySegment,
): segment is TYouTubeTranscriptCueGroupSegment {
  return (
    "cue_group_renderer" in segment && segment.cue_group_renderer !== undefined
  );
}

/**
 * 타입 가드: GenericSegment 여부 확인
 * 
 * @param segment - 검사할 세그먼트
 * @returns TranscriptSegment도 CueGroupSegment도 아닌 일반 세그먼트인지 여부
 * 
 * @remarks
 * 다른 두 타입이 아닌 모든 세그먼트를 GenericSegment로 간주합니다.
 * 
 * @example
 * ```typescript
 * const segment: TYouTubeTranscriptAnySegment = {...};
 * 
 * if (isYouTubeTranscriptGenericSegment(segment)) {
 *   // TypeScript가 segment를 TYouTubeTranscriptGenericSegment로 인식
 *   console.log(segment.text);
 * }
 * ```
 */
export function isYouTubeTranscriptGenericSegment(
  segment: TYouTubeTranscriptAnySegment,
): segment is TYouTubeTranscriptGenericSegment {
  return !isYouTubeTranscriptSegment(segment) && !isYouTubeTranscriptCueGroupSegment(segment);
}

/**
 * YouTube 트랜스크립트의 다양한 세그먼트 형식에서 텍스트를 추출합니다.
 * 
 * @param segment - 텍스트를 추출할 세그먼트 (다양한 형식 지원)
 * @returns 추출된 텍스트 문자열 (추출 실패 시 빈 문자열)
 * 
 * @remarks
 * YouTube API는 여러 가지 다른 형식으로 트랜스크립트를 반환할 수 있습니다:
 * - TranscriptSegmentRenderer: 일반적인 트랜스크립트 형식
 * - CueRenderer: 자막 큐 형식
 * - CueGroupSegment: 그룹화된 자막 형식
 * - GenericSegment: 기타 일반 형식
 * 
 * 이 함수는 모든 형식을 처리하여 일관된 텍스트를 반환합니다.
 * 텍스트는 여러 runs(텍스트 조각)으로 나뉘어 있을 수 있으며, 이를 자동으로 결합합니다.
 * 
 * @example
 * ```typescript
 * // TranscriptSegmentRenderer에서 텍스트 추출
 * const segment1: TYouTubeTranscriptSegment = {
 *   transcript_segment_renderer: {
 *     snippet: { text: "안녕하세요" },
 *     start_ms: "0",
 *     end_ms: "1000"
 *   }
 * };
 * const text1 = extractTextFromYouTubeTranscriptSegment(segment1);
 * // "안녕하세요"
 * 
 * // 여러 runs로 나뉜 텍스트 추출
 * const segment2: TYouTubeTranscriptSegment = {
 *   transcript_segment_renderer: {
 *     snippet: {
 *       runs: [
 *         { text: "Hello " },
 *         { text: "World" }
 *       ]
 *     },
 *     start_ms: "1000",
 *     end_ms: "2000"
 *   }
 * };
 * const text2 = extractTextFromYouTubeTranscriptSegment(segment2);
 * // "Hello World"
 * 
 * // CueGroupSegment에서 텍스트 추출
 * const segment3: TYouTubeTranscriptCueGroupSegment = {
 *   cue_group_renderer: {
 *     cues: [
 *       {
 *         cue_renderer: {
 *           text: { text: "자막 텍스트" },
 *           start_offset_ms: "0",
 *           duration_ms: "1000"
 *         }
 *       }
 *     ]
 *   }
 * };
 * const text3 = extractTextFromYouTubeTranscriptSegment(segment3);
 * // "자막 텍스트"
 * 
 * // 텍스트가 없는 경우
 * const emptySegment: TYouTubeTranscriptGenericSegment = {};
 * const text4 = extractTextFromYouTubeTranscriptSegment(emptySegment);
 * // ""
 * ```
 */
export const extractTextFromYouTubeTranscriptSegment = (
  segment: TYouTubeTranscriptAnySegment | TYouTubeTranscriptSegmentRenderer | TYouTubeTranscriptCueRenderer,
): string => {
  // 1. TranscriptSegmentRenderer가 직접 전달된 경우
  if ("snippet" in segment || "text" in segment || "runs" in segment) {
    const tsr = segment as TYouTubeTranscriptSegmentRenderer;
    if (tsr.snippet?.text) return tsr.snippet.text;
    if (tsr.text) return tsr.text;
    if (tsr.snippet?.runs)
      return tsr.snippet.runs.map((run) => run.text).join("");
    if (tsr.runs) return tsr.runs.map((run) => run.text).join("");
  }

  // 2. CueRenderer가 직접 전달된 경우
  if ("start_offset_ms" in segment || "duration_ms" in segment) {
    const cue = segment as TYouTubeTranscriptCueRenderer;
    if (cue.text?.text) return cue.text.text;
    if (cue.text?.runs) return cue.text.runs.map((run) => run.text).join("");
  }

  // 3. TranscriptSegment 처리 (transcript_segment_renderer 래퍼 포함)
  if (isYouTubeTranscriptSegment(segment)) {
    const tsr = segment.transcript_segment_renderer;
    if (tsr.snippet?.text) return tsr.snippet.text;
    if (tsr.text) return tsr.text;
    if (tsr.snippet?.runs)
      return tsr.snippet.runs.map((run) => run.text).join("");
    if (tsr.runs) return tsr.runs.map((run) => run.text).join("");
  }

  // 4. CueGroupSegment 처리 (cue_group_renderer 래퍼 포함)
  if (isYouTubeTranscriptCueGroupSegment(segment)) {
    const cue = segment.cue_group_renderer.cues?.[0]?.cue_renderer;
    if (cue?.text?.text) return cue.text.text;
    if (cue?.text?.runs) return cue.text.runs.map((run) => run.text).join("");
  }

  // 5. GenericSegment 처리 (기타 모든 형식)
  if (isYouTubeTranscriptGenericSegment(segment)) {
    // text가 문자열인 경우
    if (typeof segment.text === "string") return segment.text;

    // text가 Snippet 객체인 경우
    if (typeof segment.text === "object" && segment.text) {
      const snippet = segment.text as TYouTubeTranscriptSnippet;
      if (snippet.text) return snippet.text;
      if (snippet.runs) return snippet.runs.map((run: TYouTubeTranscriptTextRun) => run.text).join("");
    }

    // runs가 직접 있는 경우
    if (segment.runs) return segment.runs.map((run) => run.text).join("");

    // snippet 객체가 있는 경우
    if (segment.snippet) {
      if (segment.snippet.text) return segment.snippet.text;
      if (segment.snippet.runs)
        return segment.snippet.runs.map((run) => run.text).join("");
    }
  }

  // 모든 경로에서 텍스트를 찾지 못한 경우
  return "";
};