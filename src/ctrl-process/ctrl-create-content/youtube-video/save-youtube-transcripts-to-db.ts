import path from "path";
import fs from "fs/promises";
import { TYouTubeTranscriptStandardFormat, TSqlYoutubeVideoTranscriptInsert, TYouTubeTranscriptAnySegment,
  TYouTubeTranscriptCueGroupSegment,
  TYouTubeTranscriptCueRenderer,
  TYouTubeTranscriptGenericSegment,
  TYouTubeTranscriptSegment,
  TYouTubeTranscriptSegmentRenderer,
  TYouTubeTranscriptSnippet,
  TYouTubeTranscriptTextUnit, 
} from "aiqna_common_v1";
import { fetchYoutubeVideoTranscriptByLanguage } from "./fetch-youtube-video-transcript-by-language.js";
import DBSqlYoutubeVideoTranscript from "../../../ctrl-db/ctrl-db-sql/db-sql-youtube-video-transcript.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "./convert-youtube-transcript-segments-to-standard.js";
import { TXMLParsedYouTubeTranscript } from "../../../types/shared.js";
import { saveJsonToLocal } from "../../../utils/save-json-to-local.js";

/**
 * 여러 언어의 트랜스크립트를 저장하고 결과 반환 (로컬 캐시 우선)
 * @param videoId
 * @param languages
 * @param storagePath
 * @returns
 */
export async function saveYouTubeTranscriptsToDb(
  videoId: string,
  languages: string[] = ["ko", "en"],
  storagePath: string = '../data/transcripts',
): Promise<TYouTubeTranscriptStandardFormat[]> {
  const savedTranscripts: TYouTubeTranscriptStandardFormat[] = [];

  for (const lang of languages) {
    try {
      // 1. 먼저 로컬 파일 확인
      const localData = await loadTranscriptFromLocal(videoId, lang, storagePath);
      
      if (localData) {
        // 로컬 파일이 있으면 사용
        savedTranscripts.push(localData);
        console.log(`✓ ${lang} 트랜스크립트 로컬 파일 사용`);
        continue;
      }

      // 2. 로컬 파일이 없으면 fetch
      console.log(`🌐 Fetching ${lang} transcript from YouTube...`);
      const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(
        videoId,
        lang,
      );

      // DB insert 형식으로 변환
      const transcriptData = transformXMLParsedYouTubeTranscriptToStandardFormat(
        videoId,
        transcriptResult,
      );

      await DBSqlYoutubeVideoTranscript.insert(transcriptData);

      // segments_json을 Pinecone 형식으로 변환
      const pineconeSegments = convertYouTubeTranscriptSegmentsToStandard(
        transcriptData.segments_json,
      );

      // 저장할 데이터 구조
      const transcriptToSave: TYouTubeTranscriptStandardFormat = {
        videoId,
        language: transcriptData.language || transcriptResult.language,
        segments: pineconeSegments,
      };

      // 3. 로컬에 저장
      await saveJsonToLocal(
        transcriptToSave,
        videoId,
        lang,
        storagePath
      );

      savedTranscripts.push(transcriptToSave);
      console.log(`✓ ${transcriptResult.language} 트랜스크립트 fetch 및 저장 완료`);
    } catch (error) {
      const err = error as Error;
      console.log(`✗ ${lang} 트랜스크립트 처리 실패: ${err.message}`);
      continue;
    }
  }

  if (savedTranscripts.length === 0) {
    console.log("자막이 없습니다.");
    return [];
  }

  console.log(`총 ${savedTranscripts.length}개 언어 처리 완료`);
  return savedTranscripts;
}


/**
 * 로컬 파일에서 트랜스크립트 로드
 */
async function loadTranscriptFromLocal(
  videoId: string,
  language: string,
  storagePath: string = '../data/transcripts'
): Promise<TYouTubeTranscriptStandardFormat | null> {
  try {
    const expandedPath = storagePath.startsWith('~') 
      ? storagePath.replace('~', process.env.HOME || '') 
      : storagePath;
    
    const absolutePath = path.resolve(expandedPath);
    const filename = `${videoId}_${language}.json`;
    const filepath = path.join(absolutePath, filename);

    console.log(`🔍 Checking local file: ${filepath}`);
    
    const fileContent = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    console.log(`✓ Loaded from local: ${filename}`);
    return data;
  } catch (error) {
    const err = error as Error;
    console.log(`✗ ${language} 트랜스크립트 로드 실패: ${err.message}`);
    // 파일이 없거나 읽기 실패
    return null;
  }
}

/**
 * fetchYoutubeVideoTranscript 결과를 DB insert 형식으로 변환
 * @param videoId - YouTube 비디오 ID
 * @param transcriptResult - fetchYoutubeVideoTranscript 반환값
 * @param language - 트랜스크립트 언어 (기본값: 'ko')
 * @returns DB insert용 데이터
 */
function transformXMLParsedYouTubeTranscriptToStandardFormat(
  videoId: string,
  transcriptResult: TXMLParsedYouTubeTranscript,
): TSqlYoutubeVideoTranscriptInsert {
  const { transcriptSegments } = transcriptResult;

  // 전체 텍스트 추출 (검색용)
  const fullText = transcriptSegments
    .map((seg: TYouTubeTranscriptSegment) => extractOnlyTextFromYouTubeTranscriptSegment(seg))
    .filter((text) => text.trim())
    .join(" ");

  // 총 길이 계산 (마지막 세그먼트의 end_ms)
  const totalDuration =
    transcriptSegments.length > 0
      ? Math.max(
          ...transcriptSegments.map(
            (seg) =>
              parseFloat(seg.transcript_segment_renderer.end_ms || "0") / 1000,
          ),
        )
      : 0;

  return {
    video_id: videoId,
    language: transcriptResult.language,
    total_duration: totalDuration,
    segment_count: transcriptSegments.length,
    segments_json: transcriptSegments, // JSONB 컬럼에 그대로 저장
    full_text: fullText,
  };
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
const extractOnlyTextFromYouTubeTranscriptSegment = (
  segment:
    | TYouTubeTranscriptAnySegment
    | TYouTubeTranscriptSegmentRenderer
    | TYouTubeTranscriptCueRenderer,
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
      if (snippet.runs)
        return snippet.runs
          .map((run: TYouTubeTranscriptTextUnit) => run.text)
          .join("");
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
function isYouTubeTranscriptSegment(
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
function isYouTubeTranscriptCueGroupSegment(
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
function isYouTubeTranscriptGenericSegment(
  segment: TYouTubeTranscriptAnySegment,
): segment is TYouTubeTranscriptGenericSegment {
  return (
    !isYouTubeTranscriptSegment(segment) &&
    !isYouTubeTranscriptCueGroupSegment(segment)
  );
}