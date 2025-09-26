import { TYouTubeTranscriptSegment } from "aiqna_common_v1";

/**
 * SRV3 (JSON3) 형식의 타입 정의
 * YouTube 자막 API에서 반환하는 JSON 기반 자막 형식
 */
interface Srv3Segment {
  utf8?: string; // 개별 텍스트 조각
}

interface Srv3Event {
  tStartMs?: number;    // 시작 시간 (밀리초)
  dDurationMs?: number; // 지속 시간 (밀리초)
  segs?: Srv3Segment[]; // 텍스트 세그먼트 배열
}

interface Srv3Data {
  events?: Srv3Event[]; // 자막 이벤트 배열
}

/**
 * YouTube SRV3 (JSON3) 형식의 자막 데이터를 파싱하여 표준화된 트랜스크립트 세그먼트로 변환합니다.
 * 
 * @param data - SRV3 형식의 JSON 문자열 (YouTube 자막 API 응답)
 * @returns 처리된 트랜스크립트 세그먼트 배열
 * 
 * @remarks
 * SRV3는 YouTube가 사용하는 JSON 기반 자막 형식입니다:
 * - 각 이벤트는 시작 시간과 지속 시간 정보를 포함
 * - 텍스트는 여러 세그먼트로 나뉘어 있을 수 있음 (스타일링 등을 위해)
 * - 줄바꿈 문자는 공백으로 변환되어 한 줄로 처리됨
 * - 빈 텍스트 세그먼트는 자동으로 필터링됨
 * - 파싱 실패 시 빈 배열 반환 (에러를 throw하지 않음)
 * 
 * @example
 * ```typescript
 * // SRV3 형식 입력
 * const srv3Data = `{
 *   "events": [
 *     {
 *       "tStartMs": 0,
 *       "dDurationMs": 2500,
 *       "segs": [
 *         { "utf8": "안녕하세요" },
 *         { "utf8": " 여러분" }
 *       ]
 *     },
 *     {
 *       "tStartMs": 2500,
 *       "dDurationMs": 3000,
 *       "segs": [
 *         { "utf8": "오늘은\\n좋은 날입니다" }
 *       ]
 *     }
 *   ]
 * }`;
 * 
 * const segments = parseSrv3Format(srv3Data);
 * 
 * // 결과:
 * // [
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "안녕하세요 여러분" },
 * //       start_ms: "0",
 * //       end_ms: "2500"
 * //     }
 * //   },
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "오늘은 좋은 날입니다" },
 * //       start_ms: "2500",
 * //       end_ms: "5500"
 * //     }
 * //   }
 * // ]
 * ```
 */
export function parseSrv3Format(data: string): TYouTubeTranscriptSegment[] {
  try {
    const jsonData = JSON.parse(data) as Srv3Data;
    const events = jsonData.events || [];

    return events
      // segs 속성이 있는 이벤트만 필터링 (텍스트가 있는 것만)
      .filter((event): event is Required<Pick<Srv3Event, 'segs'>> & Srv3Event => 
        event.segs !== undefined
      )
      .map((event) => {
        // 여러 세그먼트의 텍스트를 하나로 결합
        const text = event.segs
          .map((seg) => seg.utf8 || '')
          .join('')
          .replace(/\n/g, ' ') // 줄바꿈을 공백으로 변환
          .trim();

        const startMs = event.tStartMs || 0;
        const durationMs = event.dDurationMs || 0;

        return {
          transcript_segment_renderer: {
            snippet: {
              text
            },
            start_ms: String(startMs),
            end_ms: String(startMs + durationMs) // 종료 시간 = 시작 + 지속시간
          }
        };
      })
      // 빈 텍스트 세그먼트 제거
      .filter((segment) => 
        segment.transcript_segment_renderer.snippet?.text
      );

  } catch (error) {
    console.error("Error parsing SRV3 format:", error);
    return []; // 파싱 실패 시 빈 배열 반환
  }
}