import { TTranscriptSegment } from "../types/youtube.js"

/**
 * SRV3 형식의 타입 정의
 */
interface Srv3Segment {
  utf8?: string;
}

interface Srv3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Srv3Segment[];
}

interface Srv3Data {
  events?: Srv3Event[];
}

/**
 * parseSrv3Format
 * SRV3 (JSON3) 형식 파싱
 * @param data
 * @returns TTranscriptSegment[]
 */
export function parseSrv3Format(data: string): TTranscriptSegment[] {
  try {
    const jsonData = JSON.parse(data) as Srv3Data;
    const events = jsonData.events || [];

    return events
      .filter((event): event is Required<Pick<Srv3Event, 'segs'>> & Srv3Event => 
        event.segs !== undefined
      )
      .map((event) => {
        const text = event.segs
          .map((seg) => seg.utf8 || '')
          .join('')
          .replace(/\n/g, ' ')
          .trim();

        const startMs = event.tStartMs || 0;
        const durationMs = event.dDurationMs || 0;

        return {
          transcript_segment_renderer: {
            snippet: {
              text
            },
            start_ms: String(startMs),
            end_ms: String(startMs + durationMs)
          }
        };
      })
      .filter((segment) => 
        segment.transcript_segment_renderer.snippet?.text
      );

  } catch (error) {
    console.error("Error parsing SRV3 format:", error);
    return [];
  }
}

// 입력 데이터 구조 (SRV3 형식):
/*
  const json = {
    "events": [
      {
        "tStartMs": 1000,
        "dDurationMs": 2000,
        "segs": [
          { "utf8": "안녕하세요" },
          { "utf8": " 여러분" }
        ]
      },
      {
        "tStartMs": 3000,
        "dDurationMs": 1500,
        "segs": [
          { "utf8": "오늘은\n좋은 날입니다" }
        ]
      }
    ]
  }
*/

// 처리 과정:
//
// JSON 파싱 - 문자열 데이터를 JSON 객체로 변환
// 이벤트 필터링 - segs 속성이 있는 이벤트만 선택 (텍스트가 있는 것만)
// 텍스트 결합 - 각 이벤트의 segs 배열을 순회하며:

// 모든 utf8 값을 합침
// 줄바꿈(\n)을 공백으로 변환
// 앞뒤 공백 제거

// 타임스탬프 변환 - 밀리초를 초 단위로 변환:

// tStartMs → offset (시작 시간)
// dDurationMs → duration (지속 시간)

// 빈 텍스트 제거 - 텍스트가 없는 세그먼트 필터링

// 출력 결과:
/* 
  const result = [
    {
      text: "안녕하세요 여러분",
      offset: 1.0,      // 1초
      duration: 2.0     // 2초
    },
    {
      text: "오늘은 좋은 날입니다",
      offset: 3.0,      // 3초
      duration: 1.5     // 1.5초
    }
  ]
*/

// 핵심 기능:

// YouTube 자막의 원시 JSON 데이터를 앱에서 사용하기 쉬운 구조로 변환
// 시간 정보와 함께 깔끔한 텍스트 제공
// 재시도Claude는 실수를 할 수 있습니다. 응답을 반드시 다시 확인해 주세요.