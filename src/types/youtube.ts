// ============================================
// types/youtube.ts - 개선된 버전 (중복 제거 및 정리)
// ============================================

import { TSupportedLanguage } from "./shared.js";

// ============================================
// 1. YouTube 원본 트랜스크립트 관련 타입들
// ============================================

/**
 * 텍스트 실행 단위를 나타내는 인터페이스
 * YouTube 트랜스크립트에서 개별 텍스트 조각을 표현
 */
export type TTextRun = {
  text: string;
};

/**
 * 텍스트 스니펫을 나타내는 인터페이스
 * 단일 텍스트 또는 여러 TextRun들의 조합으로 구성
 */
export type TSnippet = {
  text?: string; // 직접적인 텍스트 내용
  runs?: TTextRun[]; // 텍스트 실행 단위들의 배열 (스타일링된 텍스트 등)
};

/**
 * 일반적인 트랜스크립트 세그먼트 렌더러 인터페이스
 * YouTube의 표준 트랜스크립트 형식을 표현
 */
export type TTranscriptSegmentRenderer = {
  snippet?: TSnippet; // 텍스트 스니펫
  text?: string; // 직접적인 텍스트 (대안)
  runs?: TTextRun[]; // 텍스트 실행 단위들 (대안)
  start_ms?: string; // 시작 시간 (밀리초)
  end_ms?: string; // 종료 시간 (밀리초)
};

/**
 * 자막 렌더러를 나타내는 인터페이스
 * 개별 자막 항목의 구조를 정의
 */
export type TCueRenderer = {
  text?: TSnippet; // 자막 텍스트 내용
  start_offset_ms?: string; // 시작 오프셋 (밀리초)
  duration_ms?: string; // 지속 시간 (밀리초)
};

/**
 * 일반 세그먼트 인터페이스
 */
export type TGenericSegment = {
  text?: string | TSnippet;
  runs?: TTextRun[];
  snippet?: TSnippet;
  start_ms?: string;
  end_ms?: string;
  duration_ms?: string;
};

/**
 * 트랜스크립트 세그먼트 타입 (transcript_segment_renderer를 포함)
 */
export type TTranscriptSegment = {
  transcript_segment_renderer: TTranscriptSegmentRenderer;
};

/**
 * 큐 그룹 세그먼트 타입 (cue_group_renderer를 포함)
 */
export type TCueGroupSegment = {
  cue_group_renderer: {
    cues?: { cue_renderer?: TCueRenderer }[];
  };
};

/**
 * 가능한 모든 세그먼트 타입의 유니온
 */
export type TAnySegment =
  | TTranscriptSegment
  | TCueGroupSegment
  | TGenericSegment;

// ============================================
// 2. YouTube API 비디오 정보 관련 타입들
// ============================================

/**
 * YouTube API에서 가져오는 완전한 비디오 정보 Supabase DB 저장용
 * (기존 YouTubeVideoInfo와 YouTubeVideoMetadata 통합)
 */
// export type TYouTubeVideoInfo = {
//   // 기본 정보
//   id: string;
//   title: string;
//   description?: string;

//   // 채널 정보
//   channel_id?: string;
//   channel_name?: string;
//   channel_url?: string;

//   // 통계 정보
//   view_count?: number;
//   like_count?: number;
//   dislike_count?: number;
//   comment_count?: number;

//   // 미디어 정보
//   duration_seconds?: number;  // 초 단위 (더 정확함)
//   duration_text?: string;     // "4:32" 형식

//   // 썸네일 정보
//   thumbnail_url?: string;
//   thumbnail_width?: number;
//   thumbnail_height?: number;

//   // 날짜 정보
//   upload_date?: string;       // YYYY-MM-DD
//   published_date?: string;    // ISO 8601

//   // 메타데이터
//   category?: string;
//   language?: string;
//   tags?: string[];
//   keywords?: string[];        // tags와 별도로 관리

//   // 상태 정보
//   is_live?: boolean;
//   is_upcoming?: boolean;
//   is_private?: boolean;
//   age_restricted?: boolean;
//   family_safe?: boolean;
// }

// ============================================
// 3. 처리된 트랜스크립트 관련 타입들
// ============================================

/**
 * 처리된 트랜스크립트 세그먼트 (우리 시스템용)
 * - 중복되던 ProcessedTranscriptSegment 통합
 * - offset → start_time으로 명명 일관성 개선
 */
export type TProcessedTranscriptSegment = {
  text: string;
  start_time: number; // 초 단위 (float)
  end_time: number; // 초 단위 (float)
  duration: number; // 초 단위 (float)
  segment_index: number; // 순서
};

/**
 * 전체 트랜스크립트 데이터
 */
export type TTranscriptData = {
  video_id: string;
  video_title: string;
  language: string;
  segments: TProcessedTranscriptSegment[];
  total_duration: number;
  segment_count: number;
  created_at: string;
};

/**
 * API 응답용 트랜스크립트 타입
 */
export type TTranscriptResponse = {
  videoId: string; // snake_case → camelCase 일관성
  videoTitle: string;
  language?: string; // 언어 정보 추가
  transcript: TProcessedTranscriptSegment[];
  totalDuration?: number; // 전체 길이 정보 추가
  segmentCount?: number; // 세그먼트 수 추가
};

/**
 * 트랜스크립트 처리 옵션
 */
export type TTranscriptProcessingOptions = {
  language?: TSupportedLanguage;
  chunkSize?: number; // 청크 크기 (초 단위)
  overlapSize?: number; // 청크 간 겹침 (초 단위)
  minChunkLength?: number; // 최소 청크 길이 (문자 수)
  maxChunkLength?: number; // 최대 청크 길이 (문자 수)
};

/**
 * 임베딩 생성 옵션
 */
export type TEmbeddingOptions = {
  model: string; // 'text-embedding-ada-002' 등
  batchSize?: number; // 배치 크기
  retryCount?: number; // 재시도 횟수
  retryDelay?: number; // 재시도 간격 (ms)
};

// ============================================
// 6. 에러 관련 타입들
// ============================================

// {
//   "error": {
//     "code": 403, // HTTP status code와 동일한 경우가 많음
//     "message": "The request is missing a valid API key.",
//     "errors": [ // TYouTubeApiErrorDetails와 유사한 정보를 담은 배열
//       {
//         "domain": "global",
//         "reason": "required",
//         "message": "The request is missing a valid API key."
//       }
//     ],
//     "status": "PERMISSION_DENIED"
//     // ... 추가 필드 (details, status 등)
//   }
// }

/**
 * YouTube API 에러 상세 정보
 */
export type TYouTubeApiErrorDetails = {
  reason?: string;
  domain?: string;
  location?: string;
  locationType?: string;
  [key: string]: string | number | boolean | undefined;
};

/**
 * YouTube API 에러 타입
 */
export type TYouTubeApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

// ============================================
// 개선 사항 요약
// ============================================

/*
🔧 주요 개선사항:

1. ✅ 중복 제거:
  - ProcessedTranscriptSegment 중복 제거
  - YouTubeVideoMetadata와 YouTubeVideoInfo 통합

2. 🎯 명명 일관성:
  - offset → start_time으로 통일
  - snake_case → camelCase 일관성 (API 응답)

3. 📚 타입 확장:
  - ProcessingStatus, SupportedLanguage 등 유틸리티 타입 추가
  - 에러 처리 및 결과 타입 추가
  - 옵션 타입들 추가

4. 🔍 타입 정확성:
  - 선택적/필수 속성 명확화
  - 더 구체적인 타입 사용

5. 📖 문서화 개선:
  - 모든 인터페이스에 명확한 설명 추가
  - 사용 목적별 섹션 분리
*/

// ============================================
// 사용 예시 (참고용)
// ============================================

/*
// 1. 비디오 정보 처리
const videoInfo: YouTubeVideoInfo = {
  id: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  channel_name: 'Rick Astley',
  duration_seconds: 212,
  language: 'en'
};

// 2. 트랜스크립트 응답
const response: TranscriptResponse = {
  videoId: 'dQw4w9WgXcQ',
  videoTitle: 'Never Gonna Give You Up',
  language: 'en',
  transcript: processedSegments,
  totalDuration: 212,
  segmentCount: 50
};

// 3. 처리 결과
const result: ProcessingResult<TranscriptData> = {
  success: true,
  data: transcriptData,
  processingTime: 1500
};
*/
