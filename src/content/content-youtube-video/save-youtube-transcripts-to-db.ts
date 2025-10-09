import path from "path";
import fs from "fs/promises";
import {
  TYouTubeTranscriptStandardFormat,
  TSqlYoutubeVideoTranscriptInsert,
  TYouTubeTranscriptAnySegment,
  TYouTubeTranscriptCueGroupSegment,
  TYouTubeTranscriptCueRenderer,
  TYouTubeTranscriptGenericSegment,
  TYouTubeTranscriptSegment,
  TYouTubeTranscriptSegmentRenderer,
  TYouTubeTranscriptSnippet,
  TYouTubeTranscriptTextUnit,
} from "aiqna_common_v1";
import { fetchYoutubeVideoTranscriptByLanguage } from "./fetch-youtube-video-transcript-by-language.js";
import DBSqlYoutubeVideoTranscript from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video-transcript.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "./convert-youtube-transcript-segments-to-standard.js";
import { TXMLParsedYouTubeTranscript } from "../../types/shared.js";
import { saveJsonToLocal } from "../../utils/helper-json.js";
import { getAvailableTranscriptLanguages } from "./get-available-transcript-languages.js";

/**
 * 여러 언어의 트랜스크립트를 저장하고 결과 반환 (로컬 캐시 우선)
 * @param videoId
 * @param preferredLanguages - 선호하는 언어 목록
 * @param storagePath
 * @returns
 */
export async function saveYouTubeTranscriptsToDb(
  videoId: string,
  preferredLanguages: string[] = ["ko", "en"],
  storagePath: string = "../data/transcripts",
): Promise<TYouTubeTranscriptStandardFormat[]> {
  const savedTranscripts: TYouTubeTranscriptStandardFormat[] = [];

  try {
    // 1. 사용 가능한 언어 목록 가져오기
    console.log(`🔍 Checking available languages for ${videoId}...`);
    const availableLanguages = await getAvailableTranscriptLanguages(videoId);
    
    if (availableLanguages.length === 0) {
      console.warn(`⚠️ No transcripts available for ${videoId}`);
      return [];
    }

    console.log(`📋 Available languages: ${availableLanguages.join(', ')}`);

    // 2. 선호 언어와 매칭
    const languagesToFetch = findMatchingLanguages(
      preferredLanguages,
      availableLanguages
    );

    if (languagesToFetch.length === 0) {
      console.warn(
        `⚠️ None of preferred languages [${preferredLanguages.join(', ')}] available. ` +
        `Using first available: ${availableLanguages[0]}`
      );
      languagesToFetch.push(availableLanguages[0]);
    }

    console.log(`📥 Fetching transcripts for: ${languagesToFetch.join(', ')}`);

    // 3. 각 언어별로 처리
    for (const lang of languagesToFetch) {
      try {
        // 로컬 캐시 확인
        const localData = await loadTranscriptFromLocal(
          videoId,
          lang,
          storagePath,
        );

        if (localData) {
          savedTranscripts.push(localData);
          console.log(`✓ ${lang} 트랜스크립트 로컬 파일 사용`);
          continue;
        }

        // YouTube에서 fetch
        console.log(`🌐 Fetching ${lang} transcript from YouTube...`);
        const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(
          videoId,
          lang,
        );

        // DB insert 형식으로 변환
        const transcriptData =
          transformXMLParsedYouTubeTranscriptToStandardFormat(
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

        // 로컬에 저장
        await saveJsonToLocal(transcriptToSave, videoId, lang, storagePath);

        savedTranscripts.push(transcriptToSave);
        console.log(`✓ ${transcriptResult.language} 트랜스크립트 fetch 및 저장 완료`);
      } catch (error) {
        const err = error as Error;
        console.log(`✗ ${lang} 트랜스크립트 처리 실패: ${err.message}`);
        continue;
      }
    }

    if (savedTranscripts.length === 0) {
      console.warn(`⚠️ 자막을 가져올 수 없습니다. Available: [${availableLanguages.join(', ')}]`);
      return [];
    }

    console.log(`✅ 총 ${savedTranscripts.length}개 언어 처리 완료`);
    return savedTranscripts;
  } catch (error) {
    console.error(`❌ Error in saveYouTubeTranscriptsToDb for ${videoId}:`, error);
    return [];
  }
}

/**
 * 선호 언어와 사용 가능한 언어 매칭
 * 
 * @param preferred - 선호하는 언어 코드 목록 (예: ['ko', 'en'])
 * @param available - 실제 사용 가능한 언어 코드 목록 (예: ['en-GB', 'ja'])
 * @returns 매칭된 언어 코드 목록
 * 
 * @example
 * findMatchingLanguages(['ko', 'en'], ['en-GB', 'ja']) 
 * // => ['en-GB'] (en이 en-GB와 매칭)
 */
function findMatchingLanguages(
  preferred: string[],
  available: string[]
): string[] {
  const matched: string[] = [];

  for (const pref of preferred) {
    // 1. 정확히 일치하는 언어 찾기
    if (available.includes(pref)) {
      matched.push(pref);
      continue;
    }

    // 2. 언어 코드 변형 매칭 (en → en-US, en-GB 등)
    const variant = available.find(lang => 
      lang.startsWith(pref + '-') || 
      lang.toLowerCase().startsWith(pref.toLowerCase() + '-')
    );
    
    if (variant) {
      matched.push(variant);
      console.log(`  ℹ️ Matched '${pref}' to available variant '${variant}'`);
    }
  }

  return matched;
}

/**
 * 로컬 파일에서 트랜스크립트 로드
 */
async function loadTranscriptFromLocal(
  videoId: string,
  language: string,
  storagePath: string = "../data/transcripts",
): Promise<TYouTubeTranscriptStandardFormat | null> {
  try {
    const expandedPath = storagePath.startsWith("~")
      ? storagePath.replace("~", process.env.HOME || "")
      : storagePath;

    const absolutePath = path.resolve(expandedPath);
    const filename = `${videoId}_${language}.json`;
    const filepath = path.join(absolutePath, filename);

    const fileContent = await fs.readFile(filepath, "utf-8");
    const data = JSON.parse(fileContent);

    console.log(`✓ Loaded from local: ${filename}`);
    return data;
  } catch (error: unknown) {
    console.log(`Can't load transcript from local ${videoId}_${language}.json`, error);
    // 파일이 없는 경우는 정상 동작이므로 로그 최소화
    return null;
  }
}

/**
 * fetchYoutubeVideoTranscript 결과를 DB insert 형식으로 변환
 */
function transformXMLParsedYouTubeTranscriptToStandardFormat(
  videoId: string,
  transcriptResult: TXMLParsedYouTubeTranscript,
): TSqlYoutubeVideoTranscriptInsert {
  const { transcriptSegments } = transcriptResult;

  // 전체 텍스트 추출 (검색용)
  const fullText = transcriptSegments
    .map((seg: TYouTubeTranscriptSegment) =>
      extractOnlyTextFromYouTubeTranscriptSegment(seg),
    )
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
    segments_json: transcriptSegments,
    full_text: fullText,
  };
}

/**
 * YouTube 트랜스크립트의 다양한 세그먼트 형식에서 텍스트를 추출합니다.
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

  // 3. TranscriptSegment 처리
  if (isYouTubeTranscriptSegment(segment)) {
    const tsr = segment.transcript_segment_renderer;
    if (tsr.snippet?.text) return tsr.snippet.text;
    if (tsr.text) return tsr.text;
    if (tsr.snippet?.runs)
      return tsr.snippet.runs.map((run) => run.text).join("");
    if (tsr.runs) return tsr.runs.map((run) => run.text).join("");
  }

  // 4. CueGroupSegment 처리
  if (isYouTubeTranscriptCueGroupSegment(segment)) {
    const cue = segment.cue_group_renderer.cues?.[0]?.cue_renderer;
    if (cue?.text?.text) return cue.text.text;
    if (cue?.text?.runs) return cue.text.runs.map((run) => run.text).join("");
  }

  // 5. GenericSegment 처리
  if (isYouTubeTranscriptGenericSegment(segment)) {
    if (typeof segment.text === "string") return segment.text;

    if (typeof segment.text === "object" && segment.text) {
      const snippet = segment.text as TYouTubeTranscriptSnippet;
      if (snippet.text) return snippet.text;
      if (snippet.runs)
        return snippet.runs
          .map((run: TYouTubeTranscriptTextUnit) => run.text)
          .join("");
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

/**
 * 타입 가드: TranscriptSegment 여부 확인
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
 */
function isYouTubeTranscriptGenericSegment(
  segment: TYouTubeTranscriptAnySegment,
): segment is TYouTubeTranscriptGenericSegment {
  return (
    !isYouTubeTranscriptSegment(segment) &&
    !isYouTubeTranscriptCueGroupSegment(segment)
  );
}