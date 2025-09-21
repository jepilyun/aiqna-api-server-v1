/**
 * 텍스트 실행 단위를 나타내는 인터페이스
 * YouTube 트랜스크립트에서 개별 텍스트 조각을 표현
 */
interface TextRun {
  text: string;
}

/**
 * 텍스트 스니펫을 나타내는 인터페이스
 * 단일 텍스트 또는 여러 TextRun들의 조합으로 구성
 */
interface Snippet {
  text?: string;           // 직접적인 텍스트 내용
  runs?: TextRun[];        // 텍스트 실행 단위들의 배열 (스타일링된 텍스트 등)
}

/**
 * 일반적인 트랜스크립트 세그먼트 렌더러 인터페이스
 * YouTube의 표준 트랜스크립트 형식을 표현
 */
interface TranscriptSegmentRenderer {
  snippet?: Snippet;       // 텍스트 스니펫
  text?: string;           // 직접적인 텍스트 (대안)
  runs?: TextRun[];        // 텍스트 실행 단위들 (대안)
  start_ms?: string;       // 시작 시간 (밀리초)
  end_ms?: string;         // 종료 시간 (밀리초)
}

/**
 * 자막 렌더러를 나타내는 인터페이스
 * 개별 자막 항목의 구조를 정의
 */
interface CueRenderer {
  text?: Snippet;          // 자막 텍스트 내용
  start_offset_ms?: string; // 시작 오프셋 (밀리초)
  duration_ms?: string;    // 지속 시간 (밀리초)
}

/**
 * 일반 세그먼트 인터페이스
 */
interface GenericSegment {
  text?: string | Snippet;
  runs?: TextRun[];
  snippet?: Snippet;
  start_ms?: string;
  end_ms?: string;
  duration_ms?: string;
}

/**
 * 트랜스크립트 세그먼트 타입 (transcript_segment_renderer를 포함)
 */
interface TranscriptSegment {
  transcript_segment_renderer: TranscriptSegmentRenderer;
}

/**
 * 큐 그룹 세그먼트 타입 (cue_group_renderer를 포함)
 */
interface CueGroupSegment {
  cue_group_renderer: {
    cues?: { cue_renderer?: CueRenderer }[];
  };
}

/**
 * 가능한 모든 세그먼트 타입의 유니온
 */
export type AnySegment = TranscriptSegment | CueGroupSegment | GenericSegment;


/**
 * 타입 가드: TranscriptSegment 여부 확인
 */
export function isTranscriptSegment(segment: AnySegment): segment is TranscriptSegment {
  return 'transcript_segment_renderer' in segment && segment.transcript_segment_renderer !== undefined;
}

/**
 * 타입 가드: CueGroupSegment 여부 확인
 */
export function isCueGroupSegment(segment: AnySegment): segment is CueGroupSegment {
  return 'cue_group_renderer' in segment && segment.cue_group_renderer !== undefined;
}

/**
 * 타입 가드: GenericSegment 여부 확인
 */
export function isGenericSegment(segment: AnySegment): segment is GenericSegment {
  return !isTranscriptSegment(segment) && !isCueGroupSegment(segment);
}


/**
 * YouTube 트랜스크립트의 다양한 세그먼트 형식에서 텍스트를 추출하는 헬퍼 함수
 * 
 * YouTube API는 여러 가지 형태로 트랜스크립트 데이터를 제공하며,
 * 이 함수는 각각의 다른 구조를 처리하여 일관된 텍스트를 반환합니다.
 * 
 * 처리하는 형식들:
 * 1. transcript_segment_renderer - 일반적인 트랜스크립트 세그먼트
 * 2. cue_group_renderer - 자막 그룹 렌더러 (자동 생성 자막)
 * 3. text 속성을 가진 일반 세그먼트
 * 4. runs 배열을 직접 가진 세그먼트
 * 5. snippet 속성을 가진 세그먼트
 * 
 * @param segment - YouTube 트랜스크립트 세그먼트 객체
 * @returns 추출된 텍스트 문자열 또는 빈 문자열
 */
export const extractTextFromSegment = (segment: AnySegment | TranscriptSegmentRenderer | CueRenderer): string => {
  
  // 1. TranscriptSegmentRenderer가 직접 전달된 경우
  if ('snippet' in segment || 'text' in segment || 'runs' in segment) {
    const tsr = segment as TranscriptSegmentRenderer;
    if (tsr.snippet?.text) return tsr.snippet.text;
    if (tsr.text) return tsr.text;
    if (tsr.snippet?.runs) return tsr.snippet.runs.map(run => run.text).join('');
    if (tsr.runs) return tsr.runs.map(run => run.text).join('');
  }

  // 2. CueRenderer가 직접 전달된 경우
  if ('start_offset_ms' in segment || 'duration_ms' in segment) {
    const cue = segment as CueRenderer;
    if (cue.text?.text) return cue.text.text;
    if (cue.text?.runs) return cue.text.runs.map(run => run.text).join('');
  }

  // 3. TranscriptSegment 처리
  if (isTranscriptSegment(segment)) {
    const tsr = segment.transcript_segment_renderer;
    if (tsr.snippet?.text) return tsr.snippet.text;
    if (tsr.text) return tsr.text;
    if (tsr.snippet?.runs) return tsr.snippet.runs.map(run => run.text).join('');
    if (tsr.runs) return tsr.runs.map(run => run.text).join('');
  }
  
  // 4. CueGroupSegment 처리
  if (isCueGroupSegment(segment)) {
    const cue = segment.cue_group_renderer.cues?.[0]?.cue_renderer;
    if (cue?.text?.text) return cue.text.text;
    if (cue?.text?.runs) return cue.text.runs.map(run => run.text).join('');
  }
  
  // 5. GenericSegment 처리
  if (isGenericSegment(segment)) {
    if (typeof segment.text === 'string') return segment.text;
    
    if (typeof segment.text === 'object' && segment.text) {
      const snippet = segment.text as Snippet;
      if (snippet.text) return snippet.text;
      if (snippet.runs) return snippet.runs.map(run => run.text).join('');
    }
    
    if (segment.runs) return segment.runs.map(run => run.text).join('');
    
    if (segment.snippet) {
      if (segment.snippet.text) return segment.snippet.text;
      if (segment.snippet.runs) return segment.snippet.runs.map(run => run.text).join('');
    }
  }
  
  return '';
};
