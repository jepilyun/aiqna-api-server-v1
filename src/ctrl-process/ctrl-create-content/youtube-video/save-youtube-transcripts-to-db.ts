import { TPineconeFullYouTubeTranscript, TSqlYoutubeVideoTranscriptInsert, TYouTubeTranscriptSegment } from "aiqna_common_v1";
import { fetchYoutubeVideoTranscriptByLanguage } from "./fetch-youtube-video-transcript.js";
import { extractTextFromYouTubeTranscriptSegment } from "./extract-transcript-segment.js";
import DBSqlYoutubeVideoTranscript from "../../../ctrl-db/ctrl-db-sql/db-sql-youtube-video-transcript.js";
import { convertYouTubeTranscriptSegmentsToPineconeFormat } from "./convert-youtube-transcript-segments-to-pinecone-format.js";

/**
 * 여러 언어의 트랜스크립트를 저장하고 결과 반환
 * @param videoId
 * @param languages
 * @returns
 */
export async function saveYouTubeTranscriptsToDb(
  videoId: string,
  languages: string[] = ["ko", "en"],
): Promise<TPineconeFullYouTubeTranscript[]> {
  const savedTranscripts: TPineconeFullYouTubeTranscript[] = [];

  for (const lang of languages) {
    try {
      const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(
        videoId,
        lang,
      );

      // DB insert 형식으로 변환
      const transcriptData = transformYouTubeTranscriptToSqlDbInsertFormat(
        videoId,
        transcriptResult,
        transcriptResult.language,
      );

      await DBSqlYoutubeVideoTranscript.insert(transcriptData);

      // segments_json을 Pinecone 형식으로 변환
      const pineconeSegments = convertYouTubeTranscriptSegmentsToPineconeFormat(
        transcriptData.segments_json,
      );

      // 저장된 트랜스크립트 데이터 반환용으로 추가
      savedTranscripts.push({
        videoId,
        language: transcriptData.language || transcriptResult.language,
        segments: pineconeSegments,
      });

      console.log(`✓ ${transcriptResult.language} 트랜스크립트 저장 완료`);
    } catch (error) {
      const err = error as Error;
      console.log(`✗ ${lang} 트랜스크립트 없음: ${err.message}`);
      continue;
    }
  }

  if (savedTranscripts.length === 0) {
    throw new Error("No transcripts available for any language");
  }

  console.log(`총 ${savedTranscripts.length}개 언어 저장 완료`);
  return savedTranscripts;
}


/**
 * fetchYoutubeVideoTranscript 결과를 DB insert 형식으로 변환
 * @param videoId - YouTube 비디오 ID
 * @param transcriptResult - fetchYoutubeVideoTranscript 반환값
 * @param language - 트랜스크립트 언어 (기본값: 'ko')
 * @returns DB insert용 데이터
 */
export function transformYouTubeTranscriptToSqlDbInsertFormat(
  videoId: string,
  transcriptResult: {
    videoTitle: string;
    transcript: TYouTubeTranscriptSegment[];
  },
  language: string = "ko",
): TSqlYoutubeVideoTranscriptInsert {
  const { transcript } = transcriptResult;

  // 전체 텍스트 추출 (검색용)
  const fullText = transcript
    .map((seg: TYouTubeTranscriptSegment) => extractTextFromYouTubeTranscriptSegment(seg))
    .filter((text) => text.trim())
    .join(" ");

  // 총 길이 계산 (마지막 세그먼트의 end_ms)
  const totalDuration =
    transcript.length > 0
      ? Math.max(
          ...transcript.map(
            (seg) =>
              parseFloat(seg.transcript_segment_renderer.end_ms || "0") / 1000,
          ),
        )
      : 0;

  return {
    video_id: videoId,
    language,
    total_duration: totalDuration,
    segment_count: transcript.length,
    segments_json: transcript, // JSONB 컬럼에 그대로 저장
    full_text: fullText,
  };
}