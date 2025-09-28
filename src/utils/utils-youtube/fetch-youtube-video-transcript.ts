import { TYouTubeTranscriptSegment } from "aiqna_common_v1";
import { TYouTubeVideoCaptionsAvailable, TYouTubeVideoCaptionTrack } from "../../types/index.js";
import innertubeClient from "../../config/innertube.js";
import { fetchWithRetry } from "../fetch-with-retry.js";


/**
 * 특정 언어의 YouTube 트랜스크립트를 가져옵니다.
 * 
 * **주요 기능:**
 * 1. 비디오 정보 및 사용 가능한 자막 언어 목록 조회
 * 2. 특정 언어 자막이 있으면 해당 언어로 가져오기
 * 3. 특정 언어가 없으면 기본 자막으로 fallback
 * 4. 자막을 통일된 형식(TYouTubeTranscriptSegment)으로 변환
 * 
 * **처리 흐름:**
 * ```
 * fetchYoutubeVideoTranscriptByLanguage('dQw4w9WgXcQ', 'ko')
 *   ↓
 * 1. Innertube로 비디오 정보 조회
 *   ↓
 * 2. 사용 가능한 자막 언어 확인 ['ko', 'en', 'ja']
 *   ↓
 * 3-A. 'ko' 자막 있음
 *      → base_url로 XML 다운로드 (fetchWithRetry 사용)
 *      → parseTranscriptFromUrl로 파싱
 *      → TYouTubeTranscriptSegment[] 반환
 *   ↓
 * 3-B. 'ko' 자막 없음
 *      → 기본 자막 사용 (getTranscript())
 *      → 내부 파싱 로직으로 변환
 *      → TYouTubeTranscriptSegment[] 반환
 * ```
 * 
 * @param videoId - YouTube 비디오 ID (11자리 문자열)
 * @param targetLanguage - 가져올 언어 코드 (선택사항)
 * @returns 비디오 제목, 실제 사용된 언어, 트랜스크립트 세그먼트, 사용 가능한 언어 목록
 * 
 * @example
 * // 예제 1: 한국어 자막 가져오기
 * const result = await fetchYoutubeVideoTranscriptByLanguage('dQw4w9WgXcQ', 'ko');
 * // 반환값:
 * // {
 * //   videoTitle: "Rick Astley - Never Gonna Give You Up",
 * //   language: "ko",
 * //   transcript: [
 * //     {
 * //       transcript_segment_renderer: {
 * //         snippet: { text: "사랑에 대해서는 모르는 사이가 아니죠" },
 * //         start_ms: "0",
 * //         end_ms: "2500"
 * //       }
 * //     },
 * //     {
 * //       transcript_segment_renderer: {
 * //         snippet: { text: "당신도 규칙을 알고 저도 압니다" },
 * //         start_ms: "2500",
 * //         end_ms: "5000"
 * //       }
 * //     }
 * //   ],
 * //   availableLanguages: ["ko", "en", "ja"]
 * // }
 * 
 * @example
 * // 예제 2: 특정 언어가 없는 경우 기본 자막 사용
 * const result = await fetchYoutubeVideoTranscriptByLanguage('dQw4w9WgXcQ', 'fr');
 * // 'fr' 자막이 없으면 Error throw
 * // → catch하여 언어 없이 재호출하면 기본 자막 반환
 * 
 * @example
 * // 예제 3: 언어 지정 없이 기본 자막 가져오기
 * const result = await fetchYoutubeVideoTranscriptByLanguage('dQw4w9WgXcQ');
 * // 비디오의 기본 언어 자막 반환 (보통 업로더가 설정한 언어)
 * // {
 * //   videoTitle: "...",
 * //   language: "en",  // 기본 언어
 * //   transcript: [...],
 * //   availableLanguages: ["en", "ko", "ja"]
 * // }
 * 
 * @example
 * // 예제 4: 실제 사용 시나리오 (에러 처리 포함)
 * try {
 *   // 1단계: 한국어 자막 시도
 *   const result = await fetchYoutubeVideoTranscriptByLanguage('dQw4w9WgXcQ', 'ko');
 *   console.log(`한국어 자막 ${result.transcript.length}개 세그먼트`);
 * } catch (error) {
 *   if (error.message.includes('not available')) {
 *     // 2단계: 한국어 없으면 영어로 fallback
 *     const result = await fetchYoutubeVideoTranscriptByLanguage('dQw4w9WgXcQ', 'en');
 *     console.log(`영어 자막으로 대체: ${result.transcript.length}개 세그먼트`);
 *   } else if (error.message.includes('Rate limit')) {
 *     // 3단계: Rate limit이면 잠시 대기 후 재시도
 *     await sleep(5000);
 *     const result = await fetchYoutubeVideoTranscriptByLanguage('dQw4w9WgXcQ', 'ko');
 *   }
 * }
 * 
 * @throws {Error} 자막을 가져올 수 없는 경우
 * - "Transcript not available in language: ko" - 해당 언어 자막 없음
 * - "Transcript fetch failed for ko: timeout" - 네트워크 오류
 * - "Rate limit exceeded after max retries" - API 제한 초과
 */
export async function fetchYoutubeVideoTranscriptByLanguage(
  videoId: string,
  targetLanguage?: string,
): Promise<{
  videoTitle: string;
  language: string;
  transcript: TYouTubeTranscriptSegment[];
  availableLanguages?: string[];
}> {
  try {
    const info = await innertubeClient.getInfo(videoId);
    const videoTitle = info.basic_info?.title || "Untitled Video";

    // 사용 가능한 자막 언어 목록 추출
    const basicInfo = info.basic_info as Record<string, unknown>;
    const captions = info.captions as unknown as TYouTubeVideoCaptionsAvailable;
    const availableLanguages: string[] = [];

    if (captions?.caption_tracks) {
      for (const track of captions.caption_tracks) {
        if (track.language_code) {
          availableLanguages.push(track.language_code);
        }
      }
      console.log(`Available languages: ${availableLanguages.join(", ")}`);
    }

    let transcriptData;
    let actualLanguage = targetLanguage;

    // 특정 언어 자막 처리 (targetLanguage가 지정된 경우)
    if (targetLanguage && captions?.caption_tracks) {
      // 1. 해당 언어의 자막 트랙 찾기
      const targetTrack = captions.caption_tracks.find(
        (track: TYouTubeVideoCaptionTrack) => track.language_code === targetLanguage,
      );

      if (targetTrack && targetTrack.base_url) {
        try {
          // 2. base_url로 XML 자막 다운로드 (재시도 로직 포함)
          // 예: https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=ko
          const response = await fetchWithRetry(
            targetTrack.base_url,
            {},
            3,
            1000,
          );
          const transcriptText = await response.text();
          // transcriptText는 XML 형식:
          // <?xml version="1.0"?>
          // <transcript>
          //   <text start="0" dur="2.5">사랑에 대해서는 모르는 사이가 아니죠</text>
          //   <text start="2.5" dur="2.5">당신도 규칙을 알고 저도 압니다</text>
          // </transcript>

          // 3. XML을 TYouTubeTranscriptSegment[]로 파싱
          const segments = parseTranscriptFromUrl(transcriptText);

          return {
            videoTitle,
            language: targetLanguage,
            transcript: segments,
            availableLanguages,
          };
        } catch (fetchError) {
          console.error(
            `Failed to fetch transcript URL after retries:`,
            fetchError,
          );
          throw new Error(
            `Transcript fetch failed for ${targetLanguage}: ${(fetchError as Error).message}`,
          );
        }
      } else {
        // 해당 언어 자막이 없는 경우
        throw new Error(
          `Transcript not available in language: ${targetLanguage}`,
        );
      }
    } else {
      // 기본 자막 처리 (targetLanguage 미지정 또는 fallback)
      transcriptData = await info.getTranscript();
      
      // 실제 사용된 언어 추론
      actualLanguage =
        (basicInfo?.default_language as string) ||
        (basicInfo?.defaultLanguage as string) ||
        (basicInfo?.default_audio_language as string) ||
        (basicInfo?.defaultAudioLanguage as string) ||
        (availableLanguages.length > 0 ? availableLanguages[0] : undefined) ||
        "en";
    }

    // getTranscript()로 가져온 데이터를 파싱
    // Innertube의 내부 구조는 중첩된 객체 형태
    const transcriptObj = transcriptData as unknown as {
      transcript?: { content?: { body?: { initial_segments?: unknown[] } } };
      content?: { body?: { initial_segments?: unknown[] } };
      body?: { initial_segments?: unknown[] };
    };

    const segments =
      transcriptObj.transcript?.content?.body?.initial_segments ||
      transcriptObj.content?.body?.initial_segments ||
      transcriptObj.body?.initial_segments ||
      [];

    // 통일된 형식으로 변환
    const transcript: TYouTubeTranscriptSegment[] = segments
      .map((seg: unknown) => {
        const segment = seg as {
          snippet?: { text?: string };
          text?: string;
          start_ms?: string;
          end_ms?: string;
        };

        const text = segment.snippet?.text || segment.text || "";
        const startMs = segment.start_ms || "0";
        const endMs = segment.end_ms || "0";

        return {
          transcript_segment_renderer: {
            snippet: { text },
            start_ms: startMs,
            end_ms: endMs,
          },
        };
      })
      .filter(
        (s: TYouTubeTranscriptSegment) =>
          s.transcript_segment_renderer.snippet?.text,
      );

    return {
      videoTitle,
      language: actualLanguage || "unknown",
      transcript,
      availableLanguages,
    };
  } catch (error) {
    console.error(`Error fetching transcript (${targetLanguage}):`, error);
    throw error;
  }
}

/**
 * YouTube 자막 XML을 파싱하여 TYouTubeTranscriptSegment[] 배열로 변환
 * 
 * **역할:**
 * - base_url로 다운로드한 XML 텍스트를 정규식으로 파싱
 * - HTML 엔티티 디코딩 (&amp; → &, &lt; → < 등)
 * - 밀리초 단위로 시간 변환 (초 → ms)
 * 
 * **fetchYoutubeVideoTranscriptByLanguage와의 관계:**
 * ```
 * fetchYoutubeVideoTranscriptByLanguage
 *   ↓ (targetLanguage 지정된 경우)
 * fetchWithRetry(base_url)
 *   ↓ (XML 텍스트 다운로드)
 * parseTranscriptFromUrl(xmlText)  ← 이 함수
 *   ↓ (파싱 완료)
 * TYouTubeTranscriptSegment[] 반환
 * ```
 * 
 * @param xmlText - YouTube 자막 XML 텍스트
 * @returns 파싱된 트랜스크립트 세그먼트 배열
 * 
 * @example
 * // 입력 XML:
 * const xml = `<?xml version="1.0"?>
 * <transcript>
 *   <text start="0" dur="2.5">We&amp;#39;re no strangers to love</text>
 *   <text start="2.5" dur="2.5">You know the rules and so do I</text>
 *   <text start="5.0" dur="3.0">A full commitment&amp;#39;s what I&amp;#39;m thinking of</text>
 * </transcript>`;
 * 
 * const segments = parseTranscriptFromUrl(xml);
 * 
 * // 출력:
 * // [
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "We're no strangers to love" },
 * //       start_ms: "0",       // 0초 * 1000 = 0ms
 * //       end_ms: "2500"       // (0 + 2.5)초 * 1000 = 2500ms
 * //     }
 * //   },
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "You know the rules and so do I" },
 * //       start_ms: "2500",    // 2.5초 * 1000 = 2500ms
 * //       end_ms: "5000"       // (2.5 + 2.5)초 * 1000 = 5000ms
 * //     }
 * //   },
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "A full commitment's what I'm thinking of" },
 * //       start_ms: "5000",
 * //       end_ms: "8000"       // (5 + 3)초 * 1000 = 8000ms
 * //     }
 * //   }
 * // ]
 * 
 * @example
 * // HTML 엔티티 디코딩 예시:
 * // 원본 XML: <text start="10" dur="2">It&amp;#39;s a &amp;quot;great&amp;quot; day</text>
 * // 디코딩 결과: "It's a "great" day"
 * //
 * // 변환 규칙:
 * // &amp;   → &
 * // &lt;    → 
 * // &gt;    → >
 * // &quot;  → "
 * // &#39;   → '
 */
function parseTranscriptFromUrl(xmlText: string): TYouTubeTranscriptSegment[] {
  const segments: TYouTubeTranscriptSegment[] = [];
  
  // 정규식으로 <text> 태그 추출
  // 매칭 예: <text start="0" dur="2.5">Hello world</text>
  // match[1] = "0" (start)
  // match[2] = "2.5" (dur)
  // match[3] = "Hello world" (텍스트 내용)
  const textMatches = xmlText.matchAll(
    /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g,
  );

  for (const match of textMatches) {
    const startSec = parseFloat(match[1]);         // 시작 시간 (초)
    const durationSec = parseFloat(match[2]);      // 지속 시간 (초)
    const startMs = startSec * 1000;               // 밀리초로 변환
    const endMs = (startSec + durationSec) * 1000; // 종료 시간 계산

    // HTML 엔티티 디코딩
    // YouTube XML에는 특수문자가 인코딩되어 있음
    const text = match[3]
      .replace(/&amp;/g, "&")      // & 복원
      .replace(/&lt;/g, "<")       // < 복원
      .replace(/&gt;/g, ">")       // > 복원
      .replace(/&quot;/g, '"')     // " 복원
      .replace(/&#39;/g, "'");     // ' 복원

    // TYouTubeTranscriptSegment 형식으로 변환
    segments.push({
      transcript_segment_renderer: {
        snippet: { text },
        start_ms: String(startMs),
        end_ms: String(endMs),
      },
    });
  }

  return segments;
}